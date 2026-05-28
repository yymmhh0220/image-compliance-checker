import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SegmentationServiceImpl,
  fallbackPixelAnalysis,
} from './segmentationService';

/**
 * Helper to create ImageData-like objects in jsdom environment.
 * jsdom doesn't provide ImageData constructor, so we create a compatible object.
 */
function createImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  return {
    data,
    width,
    height,
    colorSpace: 'srgb' as PredefinedColorSpace,
  } as ImageData;
}

describe('fallbackPixelAnalysis', () => {
  it('should classify near-white pixels as background (0)', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // pixel 0: pure white
      250, 250, 250, 255, // pixel 1: near-white
      240, 240, 240, 255, // pixel 2: threshold (still background)
      200, 200, 200, 255, // pixel 3: gray (foreground)
    ]);
    const imageData = createImageData(data, 2, 2);

    const mask = fallbackPixelAnalysis(imageData);

    expect(mask.width).toBe(2);
    expect(mask.height).toBe(2);
    expect(mask.data[0]).toBe(0);   // pure white -> background
    expect(mask.data[1]).toBe(0);   // near-white -> background
    expect(mask.data[2]).toBe(0);   // at threshold -> background
    expect(mask.data[3]).toBe(255); // gray -> foreground
  });

  it('should classify transparent pixels as background', () => {
    const data = new Uint8ClampedArray([
      100, 50, 50, 0,    // pixel 0: transparent (alpha < 128)
      100, 50, 50, 127,  // pixel 1: semi-transparent (alpha < 128)
      100, 50, 50, 128,  // pixel 2: opaque enough, dark -> foreground
      100, 50, 50, 255,  // pixel 3: fully opaque, dark -> foreground
    ]);
    const imageData = createImageData(data, 2, 2);

    const mask = fallbackPixelAnalysis(imageData);

    expect(mask.data[0]).toBe(0);   // transparent -> background
    expect(mask.data[1]).toBe(0);   // semi-transparent -> background
    expect(mask.data[2]).toBe(255); // opaque dark -> foreground
    expect(mask.data[3]).toBe(255); // opaque dark -> foreground
  });

  it('should handle single-channel near-white correctly', () => {
    // Only one channel below 240 means it's NOT near-white -> foreground
    const data = new Uint8ClampedArray([
      239, 255, 255, 255, // R below 240 -> foreground
      255, 239, 255, 255, // G below 240 -> foreground
      255, 255, 239, 255, // B below 240 -> foreground
      240, 240, 240, 255, // all at 240 -> background
    ]);
    const imageData = createImageData(data, 2, 2);

    const mask = fallbackPixelAnalysis(imageData);

    expect(mask.data[0]).toBe(255); // not all channels >= 240
    expect(mask.data[1]).toBe(255); // not all channels >= 240
    expect(mask.data[2]).toBe(255); // not all channels >= 240
    expect(mask.data[3]).toBe(0);   // all channels >= 240 -> background
  });

  it('should produce correct dimensions', () => {
    const width = 10;
    const height = 5;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const imageData = createImageData(data, width, height);

    const mask = fallbackPixelAnalysis(imageData);

    expect(mask.width).toBe(width);
    expect(mask.height).toBe(height);
    expect(mask.data.length).toBe(width * height);
  });

  it('should handle a mix of foreground and background pixels', () => {
    // 3x1 image: white, colored, white
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // white -> background
      100, 50, 200, 255,  // colored -> foreground
      245, 248, 250, 255, // near-white -> background
    ]);
    const imageData = createImageData(data, 3, 1);

    const mask = fallbackPixelAnalysis(imageData);

    expect(mask.width).toBe(3);
    expect(mask.height).toBe(1);
    expect(mask.data[0]).toBe(0);   // background
    expect(mask.data[1]).toBe(255); // foreground
    expect(mask.data[2]).toBe(0);   // background
  });
});

describe('SegmentationServiceImpl', () => {
  let service: SegmentationServiceImpl;

  beforeEach(() => {
    vi.resetModules();
    service = new SegmentationServiceImpl({
      modelUrl: '/nonexistent/model.onnx',
      maxRetries: 1, // Reduce retries for faster tests
    });
  });

  it('should not be ready before initialization', () => {
    expect(service.isReady()).toBe(false);
  });

  it('should fall back to pixel analysis when model fails to load', async () => {
    vi.mock('onnxruntime-web', () => ({
      InferenceSession: {
        create: vi.fn().mockRejectedValue(new Error('Model not found')),
      },
      Tensor: vi.fn(),
    }));

    await service.initialize();

    expect(service.isReady()).toBe(true);
    expect(service.isUsingFallback()).toBe(true);
  });

  it('should use fallback for segmentation when model is unavailable', async () => {
    vi.mock('onnxruntime-web', () => ({
      InferenceSession: {
        create: vi.fn().mockRejectedValue(new Error('Model not found')),
      },
      Tensor: vi.fn(),
    }));

    // Create a simple test image
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // white -> background
      100, 50, 50, 255,   // dark -> foreground
      255, 255, 255, 255, // white -> background
      50, 100, 50, 255,   // dark -> foreground
    ]);
    const imageData = createImageData(data, 2, 2);

    const mask = await service.segment(imageData);

    expect(mask.width).toBe(2);
    expect(mask.height).toBe(2);
    expect(mask.data[0]).toBe(0);   // white -> background
    expect(mask.data[1]).toBe(255); // dark -> foreground
    expect(mask.data[2]).toBe(0);   // white -> background
    expect(mask.data[3]).toBe(255); // dark -> foreground
  });

  it('should only initialize once even if called multiple times', async () => {
    vi.mock('onnxruntime-web', () => ({
      InferenceSession: {
        create: vi.fn().mockRejectedValue(new Error('Model not found')),
      },
      Tensor: vi.fn(),
    }));

    const promise1 = service.initialize();
    const promise2 = service.initialize();

    await Promise.all([promise1, promise2]);

    expect(service.isReady()).toBe(true);
  });

  it('should report not using fallback initially', () => {
    expect(service.isUsingFallback()).toBe(false);
  });
});
