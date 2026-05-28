/**
 * Analysis Web Worker
 *
 * Runs image segmentation tasks off the main thread to prevent UI blocking.
 * Communicates with the main thread via postMessage.
 */

import { SegmentationServiceImpl, fallbackPixelAnalysis } from '../core/segmentation/segmentationService';
import type { SegmentationMask } from '../types';

// Message types for worker communication
export interface WorkerRequest {
  type: 'initialize' | 'segment';
  id: string;
  payload?: WorkerInitPayload | WorkerSegmentPayload;
}

export interface WorkerInitPayload {
  modelUrl?: string;
  inputSize?: number;
  threshold?: number;
}

export interface WorkerSegmentPayload {
  imageData: {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };
}

export interface WorkerResponse {
  type: 'initialized' | 'segmented' | 'error';
  id: string;
  payload?: SegmentationMask | WorkerErrorPayload;
}

export interface WorkerErrorPayload {
  message: string;
  usedFallback?: boolean;
}

// Worker-scoped segmentation service instance
let service: SegmentationServiceImpl | null = null;

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, id, payload } = event.data;

  try {
    switch (type) {
      case 'initialize':
        await handleInitialize(id, payload as WorkerInitPayload | undefined);
        break;
      case 'segment':
        await handleSegment(id, payload as WorkerSegmentPayload);
        break;
      default:
        postResponse({
          type: 'error',
          id,
          payload: { message: `Unknown message type: ${type}` },
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    postResponse({
      type: 'error',
      id,
      payload: { message },
    });
  }
};

/**
 * Initialize the segmentation service within the worker.
 */
async function handleInitialize(
  id: string,
  payload?: WorkerInitPayload
): Promise<void> {
  service = new SegmentationServiceImpl({
    modelUrl: payload?.modelUrl,
    inputSize: payload?.inputSize,
    threshold: payload?.threshold,
  });

  await service.initialize();

  postResponse({
    type: 'initialized',
    id,
  });
}

/**
 * Run segmentation on the provided image data.
 */
async function handleSegment(
  id: string,
  payload: WorkerSegmentPayload
): Promise<void> {
  const { imageData: rawImageData } = payload;

  // Reconstruct ImageData from transferred data
  const imageData = new ImageData(
    new Uint8ClampedArray(rawImageData.data),
    rawImageData.width,
    rawImageData.height
  );

  let mask: SegmentationMask;

  if (service && service.isReady()) {
    mask = await service.segment(imageData);
  } else {
    // If service not initialized, use fallback directly
    mask = fallbackPixelAnalysis(imageData);
  }

  postResponse({
    type: 'segmented',
    id,
    payload: mask,
  });
}

/**
 * Post a response message back to the main thread.
 */
function postResponse(response: WorkerResponse): void {
  self.postMessage(response);
}
