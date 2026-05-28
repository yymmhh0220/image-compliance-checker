import JSZip from 'jszip';
import { ExportFormat, ExportItem, ExportOptions } from '../../types';

/**
 * MIME type mapping for export formats
 */
const FORMAT_MIME_MAP: Record<ExportFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * File extension mapping for export formats
 */
const FORMAT_EXTENSION_MAP: Record<ExportFormat, string> = {
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
};

/**
 * Creates a canvas from ImageData, preserving original resolution.
 */
function createCanvasFromImageData(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas 2d context');
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Export ImageData as JPEG blob.
 * @param imageData - The image data to export
 * @param quality - JPEG quality (1-100, default 90)
 * @returns Promise resolving to a Blob in JPEG format
 */
export function exportAsJPEG(imageData: ImageData, quality: number = 90): Promise<Blob> {
  const normalizedQuality = Math.max(1, Math.min(100, quality)) / 100;
  const canvas = createCanvasFromImageData(imageData);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to export image as JPEG'));
        }
      },
      FORMAT_MIME_MAP.jpeg,
      normalizedQuality
    );
  });
}

/**
 * Export ImageData as PNG blob.
 * @param imageData - The image data to export
 * @returns Promise resolving to a Blob in PNG format
 */
export function exportAsPNG(imageData: ImageData): Promise<Blob> {
  const canvas = createCanvasFromImageData(imageData);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to export image as PNG'));
        }
      },
      FORMAT_MIME_MAP.png
    );
  });
}

/**
 * Export ImageData as WebP blob.
 * @param imageData - The image data to export
 * @param quality - WebP quality (1-100, default 90)
 * @returns Promise resolving to a Blob in WebP format
 */
export function exportAsWebP(imageData: ImageData, quality: number = 90): Promise<Blob> {
  const normalizedQuality = Math.max(1, Math.min(100, quality)) / 100;
  const canvas = createCanvasFromImageData(imageData);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to export image as WebP'));
        }
      },
      FORMAT_MIME_MAP.webp,
      normalizedQuality
    );
  });
}

/**
 * Estimate the output file size in bytes for a given format and quality.
 *
 * This uses heuristic multipliers based on typical compression ratios:
 * - PNG: ~4 bytes per pixel (lossless, depends on content)
 * - JPEG: compression ratio varies with quality
 * - WebP: similar to JPEG but slightly better compression
 *
 * @param imageData - The image data to estimate size for
 * @param format - The target export format
 * @param quality - Quality setting (1-100, only affects JPEG/WebP)
 * @returns Estimated file size in bytes
 */
export function estimateFileSize(
  imageData: ImageData,
  format: ExportFormat,
  quality: number = 90
): number {
  const totalPixels = imageData.width * imageData.height;
  const normalizedQuality = Math.max(1, Math.min(100, quality));

  switch (format) {
    case 'png': {
      // PNG is lossless; estimate ~3-4 bytes per pixel depending on content complexity
      // Use a conservative estimate of 3 bytes per pixel
      return Math.round(totalPixels * 3);
    }
    case 'jpeg': {
      // JPEG compression ratio depends heavily on quality
      // At quality 100: ~1.5 bytes/pixel, at quality 1: ~0.1 bytes/pixel
      // Linear interpolation between these bounds
      const bytesPerPixel = 0.1 + (normalizedQuality / 100) * 1.4;
      return Math.round(totalPixels * bytesPerPixel);
    }
    case 'webp': {
      // WebP is typically 25-35% smaller than JPEG at equivalent quality
      const jpegBytesPerPixel = 0.1 + (normalizedQuality / 100) * 1.4;
      const webpBytesPerPixel = jpegBytesPerPixel * 0.7;
      return Math.round(totalPixels * webpBytesPerPixel);
    }
    default:
      return Math.round(totalPixels * 3);
  }
}

/**
 * Generate a default file name for export.
 * Format: "originalName_compliant.extension"
 *
 * @param originalFileName - The original file name (e.g., "product.jpg")
 * @param format - The target export format
 * @returns The generated default file name (e.g., "product_compliant.jpeg")
 */
export function generateDefaultFileName(
  originalFileName: string,
  format: ExportFormat
): string {
  // Remove the extension from the original file name
  const lastDotIndex = originalFileName.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
  const extension = FORMAT_EXTENSION_MAP[format];

  return `${baseName}_compliant.${extension}`;
}

/**
 * Main export function that dispatches to format-specific export functions.
 * Preserves the original resolution of the image.
 *
 * @param imageData - The image data to export
 * @param options - Export options including format, quality, and file name
 * @returns Promise resolving to a Blob of the exported image
 */
export async function exportImage(
  imageData: ImageData,
  options: ExportOptions
): Promise<Blob> {
  const { format, quality } = options;

  switch (format) {
    case 'jpeg':
      return exportAsJPEG(imageData, quality);
    case 'png':
      return exportAsPNG(imageData);
    case 'webp':
      return exportAsWebP(imageData, quality);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}


/**
 * Export multiple images as a ZIP file.
 * Each ExportItem specifies the image, format, quality, and desired filename.
 *
 * @param images - Array of ExportItem objects to include in the ZIP
 * @returns Promise resolving to a Blob containing the ZIP file
 */
export async function exportBatchAsZip(images: ExportItem[]): Promise<Blob> {
  const zip = new JSZip();

  for (const item of images) {
    const blob = await exportImage(item.image.imageData, item.options);
    zip.file(item.options.fileName, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

/**
 * Download a Blob as a file by creating a temporary link and triggering a click.
 *
 * @param blob - The Blob to download
 * @param fileName - The file name for the download
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
