import { create } from 'zustand';
import type { UploadedImage, SegmentationMask, CorrectedImage } from '../types';

export interface ImageState {
  // State
  images: UploadedImage[];
  currentImageId: string | null;
  segmentationMasks: Map<string, SegmentationMask>;
  corrections: Map<string, CorrectedImage>;

  // Actions
  addImages: (images: UploadedImage[]) => void;
  removeImage: (imageId: string) => void;
  setCurrentImage: (imageId: string | null) => void;
  setSegmentationMask: (imageId: string, mask: SegmentationMask) => void;
  setCorrectedImage: (imageId: string, corrected: CorrectedImage) => void;
  updateImageStatus: (imageId: string, status: UploadedImage['uploadStatus'], errorMessage?: string) => void;
}

export const useImageStore = create<ImageState>((set) => ({
  images: [],
  currentImageId: null,
  segmentationMasks: new Map(),
  corrections: new Map(),

  addImages: (newImages) =>
    set((state) => ({
      images: [...state.images, ...newImages],
    })),

  removeImage: (imageId) =>
    set((state) => {
      const newMasks = new Map(state.segmentationMasks);
      newMasks.delete(imageId);
      const newCorrections = new Map(state.corrections);
      newCorrections.delete(imageId);
      return {
        images: state.images.filter((img) => img.id !== imageId),
        currentImageId: state.currentImageId === imageId ? null : state.currentImageId,
        segmentationMasks: newMasks,
        corrections: newCorrections,
      };
    }),

  setCurrentImage: (imageId) =>
    set({ currentImageId: imageId }),

  setSegmentationMask: (imageId, mask) =>
    set((state) => {
      const newMasks = new Map(state.segmentationMasks);
      newMasks.set(imageId, mask);
      return { segmentationMasks: newMasks };
    }),

  setCorrectedImage: (imageId, corrected) =>
    set((state) => {
      const newCorrections = new Map(state.corrections);
      newCorrections.set(imageId, corrected);
      return { corrections: newCorrections };
    }),

  updateImageStatus: (imageId, status, errorMessage) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === imageId
          ? { ...img, uploadStatus: status, errorMessage }
          : img
      ),
    })),
}));
