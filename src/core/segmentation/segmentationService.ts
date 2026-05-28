import type { SegmentationMask, SegmentationService } from '../../types';

/**
 * Configuration for the segmentation service
 */
export interface SegmentationConfig {
  /** URL or path to the ONNX model file */
  modelUrl: string;
  /** Input size expected by the model (default: 320x320) */
  inputSize: number;
  /** Threshold for binary mask (default: 0.5) */
  threshold: number;
  /** Maximum retry attempts for model loading (default: 3) */
  maxRetries: number;
}

const DEFAULT_CONFIG: SegmentationConfig = {
  modelUrl: '/models/u2net.onnx',
  inputSize: 320,
  threshold: 0.5,
  maxRetries: 3,
};

/**
 * Basic pixel analysis fallback when ONNX model is unavailable.
 * Detects near-white pixels as background (all channels >= 240).
 */
export function fallbackPixelAnalysis(imageData: ImageData): SegmentationMask {
  const { width, height, data } = imageData;
  const maskData = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];

    // Transparent pixels or near-white pixels are background
    const isBackground =
      a < 128 || (r >= 240 && g >= 240 && b >= 240);

    maskData[i] = isBackground ? 0 : 255;
  }

  return { width, height, data: maskData };
}

/**
 * Preprocesses ImageData for U²-Net model input.
 * Resizes to inputSize x inputSize, normalizes to [0,1], converts to NCHW format.
 */
export function preprocessImage(
  imageData: ImageData,
  inputSize: number
): Float32Array {
  // Create an offscreen canvas to resize
  const canvas = new OffscreenCanvas(inputSize, inputSize);
  const ctx = canvas.getContext('2d')!;

  // Draw the image data onto a temporary canvas first
  const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.putImageData(imageData, 0, 0);

  // Resize by drawing onto the target canvas
  ctx.drawImage(srcCanvas, 0, 0, inputSize, inputSize);
  const resizedData = ctx.getImageData(0, 0, inputSize, inputSize);

  // Convert to NCHW format with normalization to [0, 1]
  const tensorSize = 3 * inputSize * inputSize;
  const tensor = new Float32Array(tensorSize);
  const channelSize = inputSize * inputSize;

  for (let i = 0; i < channelSize; i++) {
    tensor[i] = resizedData.data[i * 4] / 255.0;                    // R channel
    tensor[channelSize + i] = resizedData.data[i * 4 + 1] / 255.0;  // G channel
    tensor[2 * channelSize + i] = resizedData.data[i * 4 + 2] / 255.0; // B channel
  }

  return tensor;
}

/**
 * Postprocesses model output to produce a binary segmentation mask.
 * Thresholds at the configured value, resizes back to original dimensions.
 */
export function postprocessOutput(
  output: Float32Array,
  modelOutputSize: number,
  originalWidth: number,
  originalHeight: number,
  threshold: number
): SegmentationMask {
  // Create binary mask at model output resolution
  const modelCanvas = new OffscreenCanvas(modelOutputSize, modelOutputSize);
  const modelCtx = modelCanvas.getContext('2d')!;
  const modelImageData = modelCtx.createImageData(modelOutputSize, modelOutputSize);

  for (let i = 0; i < modelOutputSize * modelOutputSize; i++) {
    // Apply sigmoid if output is logits, otherwise use directly
    const value = output[i] > threshold ? 255 : 0;
    modelImageData.data[i * 4] = value;
    modelImageData.data[i * 4 + 1] = value;
    modelImageData.data[i * 4 + 2] = value;
    modelImageData.data[i * 4 + 3] = 255;
  }

  modelCtx.putImageData(modelImageData, 0, 0);

  // Resize back to original dimensions
  const outputCanvas = new OffscreenCanvas(originalWidth, originalHeight);
  const outputCtx = outputCanvas.getContext('2d')!;
  outputCtx.drawImage(modelCanvas, 0, 0, originalWidth, originalHeight);

  const finalData = outputCtx.getImageData(0, 0, originalWidth, originalHeight);
  const maskData = new Uint8Array(originalWidth * originalHeight);

  for (let i = 0; i < originalWidth * originalHeight; i++) {
    // Use red channel value (all channels are the same)
    maskData[i] = finalData.data[i * 4] >= 128 ? 255 : 0;
  }

  return { width: originalWidth, height: originalHeight, data: maskData };
}

/**
 * Delays execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Implementation of the SegmentationService using ONNX Runtime + U²-Net.
 * Falls back to basic pixel analysis if the model cannot be loaded.
 */
export class SegmentationServiceImpl implements SegmentationService {
  private config: SegmentationConfig;
  private session: unknown | null = null;
  private ready = false;
  private useFallback = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<SegmentationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the ONNX model with retry logic (3 attempts, exponential backoff).
   * If all retries fail, enables fallback mode (basic pixel analysis).
   */
  async initialize(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const ort = await import('onnxruntime-web');
        this.session = await ort.InferenceSession.create(this.config.modelUrl, {
          executionProviders: ['wasm'],
        });
        this.ready = true;
        this.useFallback = false;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[SegmentationService] Model load attempt ${attempt}/${this.config.maxRetries} failed:`,
          lastError.message
        );

        if (attempt < this.config.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s...
          await delay(Math.pow(2, attempt - 1) * 1000);
        }
      }
    }

    // All retries exhausted - enable fallback mode
    console.warn(
      '[SegmentationService] All model load attempts failed. Using fallback pixel analysis.',
      lastError
    );
    this.useFallback = true;
    this.ready = true;
  }

  /**
   * Returns whether the service is ready (either model loaded or fallback enabled).
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Returns whether the service is using fallback mode.
   */
  isUsingFallback(): boolean {
    return this.useFallback;
  }

  /**
   * Segment the image into foreground and background.
   * Uses ONNX model if available, otherwise falls back to basic pixel analysis.
   */
  async segment(imageData: ImageData): Promise<SegmentationMask> {
    if (!this.ready) {
      await this.initialize();
    }

    if (this.useFallback || !this.session) {
      return fallbackPixelAnalysis(imageData);
    }

    try {
      return await this._runInference(imageData);
    } catch (error) {
      console.warn(
        '[SegmentationService] Inference failed, using fallback:',
        error
      );
      return fallbackPixelAnalysis(imageData);
    }
  }

  private async _runInference(imageData: ImageData): Promise<SegmentationMask> {
    const ort = await import('onnxruntime-web');
    const { inputSize, threshold } = this.config;

    // Preprocess: resize to inputSize x inputSize, normalize, NCHW
    const inputTensor = preprocessImage(imageData, inputSize);

    // Create ONNX tensor
    const tensor = new ort.Tensor('float32', inputTensor, [1, 3, inputSize, inputSize]);

    // Run inference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = this.session as any;
    const inputName = session.inputNames[0];
    const feeds: Record<string, unknown> = { [inputName]: tensor };
    const results = await session.run(feeds);

    // Get the first output (U²-Net outputs multiple maps, use the first/finest)
    const outputName = session.outputNames[0];
    const outputTensor = results[outputName];
    const outputData = outputTensor.data as Float32Array;

    // Postprocess: threshold and resize back to original dimensions
    return postprocessOutput(
      outputData,
      inputSize,
      imageData.width,
      imageData.height,
      threshold
    );
  }
}

/**
 * Singleton instance of the segmentation service.
 * Configure by calling initialize() before use.
 */
export const segmentationService = new SegmentationServiceImpl();
