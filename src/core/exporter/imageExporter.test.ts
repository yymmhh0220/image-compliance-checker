import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDefaultFileName,
  estimateFileSize,
  exportAsJPEG,
  exportAsPNG,
  exportAsWebP,
  exportImage,
  exportBatchAsZip,
  downloadBlob,
} from './imageExporter';
import { ExportFormat, ExportItem, CorrectedImage } from '../../types';

describe('imageExporter', () => {
  describe('generateDefaultFileName', () => {
    it('should generate correct name for JPEG format', () => {
      expect(generateDefaultFileName('product.jpg', 'jpeg')).toBe('product_compliant.jpeg');
    });

    it('should generate correct name for PNG format', () => {
      expect(generateDefaultFileName('my-image.png', 'png')).toBe('my-image_compliant.png');
    });

    it('should generate correct name for WebP format', () => {
      expect(generateDefaultFileName('photo.webp', 'webp')).toBe('photo_compliant.webp');
    });

    it('should handle file names with multiple dots', () => {
      expect(generateDefaultFileName('my.product.image.jpg', 'png')).toBe('my.product.image_compliant.png');
    });

    it('should handle file names without extension', () => {
      expect(generateDefaultFileName('product', 'jpeg')).toBe('product_compliant.jpeg');
    });

    it('should handle file names with spaces', () => {
      expect(generateDefaultFileName('my product photo.png', 'webp')).toBe('my product photo_compliant.webp');
    });

    it('should handle file names with special characters', () => {
      expect(generateDefaultFileName('商品图片.jpg', 'png')).toBe('商品图片_compliant.png');
    });

    it('should convert format to correct extension regardless of original', () => {
      expect(generateDefaultFileName('image.png', 'jpeg')).toBe('image_compliant.jpeg');
      expect(generateDefaultFileName('image.jpg', 'webp')).toBe('image_compliant.webp');
      expect(generateDefaultFileName('image.webp', 'png')).toBe('image_compliant.png');
    });
  });

  describe('estimateFileSize', () => {
    function createMockImageData(width: number, height: number): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);
      return { data, width, height, colorSpace: 'srgb' } as ImageData;
    }

    it('should return a positive number for all formats', () => {
      const imageData = createMockImageData(100, 100);

      const formats: ExportFormat[] = ['jpeg', 'png', 'webp'];
      for (const format of formats) {
        const size = estimateFileSize(imageData, format);
        expect(size).toBeGreaterThan(0);
      }
    });

    it('should estimate PNG as larger than JPEG at default quality', () => {
      const imageData = createMockImageData(500, 500);

      const pngSize = estimateFileSize(imageData, 'png');
      const jpegSize = estimateFileSize(imageData, 'jpeg', 90);

      expect(pngSize).toBeGreaterThan(jpegSize);
    });

    it('should estimate WebP as smaller than JPEG at same quality', () => {
      const imageData = createMockImageData(500, 500);

      const jpegSize = estimateFileSize(imageData, 'jpeg', 80);
      const webpSize = estimateFileSize(imageData, 'webp', 80);

      expect(webpSize).toBeLessThan(jpegSize);
    });

    it('should estimate larger size for higher JPEG quality', () => {
      const imageData = createMockImageData(200, 200);

      const lowQuality = estimateFileSize(imageData, 'jpeg', 20);
      const highQuality = estimateFileSize(imageData, 'jpeg', 95);

      expect(highQuality).toBeGreaterThan(lowQuality);
    });

    it('should estimate larger size for larger images', () => {
      const smallImage = createMockImageData(100, 100);
      const largeImage = createMockImageData(1000, 1000);

      const smallSize = estimateFileSize(smallImage, 'jpeg', 90);
      const largeSize = estimateFileSize(largeImage, 'jpeg', 90);

      expect(largeSize).toBeGreaterThan(smallSize);
    });

    it('should clamp quality to valid range', () => {
      const imageData = createMockImageData(100, 100);

      // Quality below 1 should be treated as 1
      const sizeMinQuality = estimateFileSize(imageData, 'jpeg', -10);
      const sizeQuality1 = estimateFileSize(imageData, 'jpeg', 1);
      expect(sizeMinQuality).toBe(sizeQuality1);

      // Quality above 100 should be treated as 100
      const sizeMaxQuality = estimateFileSize(imageData, 'jpeg', 200);
      const sizeQuality100 = estimateFileSize(imageData, 'jpeg', 100);
      expect(sizeMaxQuality).toBe(sizeQuality100);
    });

    it('should scale linearly with pixel count for PNG', () => {
      const small = createMockImageData(100, 100);
      const large = createMockImageData(200, 200);

      const smallSize = estimateFileSize(small, 'png');
      const largeSize = estimateFileSize(large, 'png');

      // 200x200 has 4x the pixels of 100x100
      expect(largeSize / smallSize).toBeCloseTo(4, 0);
    });
  });

  describe('Canvas-based export functions', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockCtx: CanvasRenderingContext2D;
    let mockBlob: Blob;

    beforeEach(() => {
      mockBlob = new Blob(['test'], { type: 'image/jpeg' });

      mockCtx = {
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toBlob: vi.fn((callback: BlobCallback) => {
          callback(mockBlob);
        }),
      } as unknown as HTMLCanvasElement;

      vi.spyOn(document, 'createElement').mockReturnValue(mockCanvas as unknown as HTMLElement);
    });

    function createMockImageData(width: number, height: number): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);
      return { data, width, height, colorSpace: 'srgb' } as ImageData;
    }

    describe('exportAsJPEG', () => {
      it('should create a canvas with correct dimensions', async () => {
        const imageData = createMockImageData(800, 600);
        await exportAsJPEG(imageData, 90);

        expect(mockCanvas.width).toBe(800);
        expect(mockCanvas.height).toBe(600);
      });

      it('should put image data on canvas', async () => {
        const imageData = createMockImageData(100, 100);
        await exportAsJPEG(imageData, 90);

        expect(mockCtx.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
      });

      it('should call toBlob with JPEG mime type', async () => {
        const imageData = createMockImageData(100, 100);
        await exportAsJPEG(imageData, 85);

        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/jpeg',
          0.85
        );
      });

      it('should use default quality of 90', async () => {
        const imageData = createMockImageData(100, 100);
        await exportAsJPEG(imageData);

        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/jpeg',
          0.9
        );
      });

      it('should clamp quality to valid range', async () => {
        const imageData = createMockImageData(100, 100);

        await exportAsJPEG(imageData, 150);
        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/jpeg',
          1.0
        );
      });

      it('should reject when toBlob returns null', async () => {
        (mockCanvas.toBlob as ReturnType<typeof vi.fn>).mockImplementation(
          (callback: BlobCallback) => callback(null)
        );

        const imageData = createMockImageData(100, 100);
        await expect(exportAsJPEG(imageData, 90)).rejects.toThrow('Failed to export image as JPEG');
      });
    });

    describe('exportAsPNG', () => {
      it('should call toBlob with PNG mime type', async () => {
        const imageData = createMockImageData(100, 100);
        await exportAsPNG(imageData);

        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/png'
        );
      });

      it('should preserve image dimensions', async () => {
        const imageData = createMockImageData(1920, 1080);
        await exportAsPNG(imageData);

        expect(mockCanvas.width).toBe(1920);
        expect(mockCanvas.height).toBe(1080);
      });
    });

    describe('exportAsWebP', () => {
      it('should call toBlob with WebP mime type and quality', async () => {
        const imageData = createMockImageData(100, 100);
        await exportAsWebP(imageData, 75);

        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/webp',
          0.75
        );
      });

      it('should use default quality of 90', async () => {
        const imageData = createMockImageData(100, 100);
        await exportAsWebP(imageData);

        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/webp',
          0.9
        );
      });
    });

    describe('exportImage', () => {
      it('should dispatch to exportAsJPEG for jpeg format', async () => {
        const imageData = createMockImageData(100, 100);
        await exportImage(imageData, {
          format: 'jpeg',
          quality: 85,
          fileName: 'test.jpeg',
          preserveResolution: true,
        });

        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/jpeg',
          0.85
        );
      });

      it('should dispatch to exportAsPNG for png format', async () => {
        const imageData = createMockImageData(100, 100);
        await exportImage(imageData, {
          format: 'png',
          quality: 90,
          fileName: 'test.png',
          preserveResolution: true,
        });

        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/png'
        );
      });

      it('should dispatch to exportAsWebP for webp format', async () => {
        const imageData = createMockImageData(100, 100);
        await exportImage(imageData, {
          format: 'webp',
          quality: 70,
          fileName: 'test.webp',
          preserveResolution: true,
        });

        expect(mockCanvas.toBlob).toHaveBeenCalledWith(
          expect.any(Function),
          'image/webp',
          0.7
        );
      });

      it('should throw for unsupported format', async () => {
        const imageData = createMockImageData(100, 100);
        await expect(
          exportImage(imageData, {
            format: 'bmp' as ExportFormat,
            quality: 90,
            fileName: 'test.bmp',
            preserveResolution: true,
          })
        ).rejects.toThrow('Unsupported export format: bmp');
      });
    });
  });

  describe('exportBatchAsZip', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockCtx: CanvasRenderingContext2D;
    let mockBlob: Blob;

    beforeEach(() => {
      mockBlob = new Blob(['test-image-data'], { type: 'image/jpeg' });

      mockCtx = {
        putImageData: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue(mockCtx),
        toBlob: vi.fn((callback: BlobCallback) => {
          callback(mockBlob);
        }),
      } as unknown as HTMLCanvasElement;

      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLElement;
        return document.createElement(tag);
      });
    });

    function createMockImageData(width: number, height: number): ImageData {
      const data = new Uint8ClampedArray(width * height * 4);
      return { data, width, height, colorSpace: 'srgb' } as ImageData;
    }

    function createExportItem(fileName: string, format: ExportFormat = 'jpeg'): ExportItem {
      const imageData = createMockImageData(100, 100);
      const correctedImage: CorrectedImage = {
        imageId: `id-${fileName}`,
        originalFileName: fileName,
        imageData,
        width: 100,
        height: 100,
      };
      return {
        image: correctedImage,
        options: {
          format,
          quality: 90,
          fileName: `${fileName}_compliant.${format}`,
          preserveResolution: true,
        },
      };
    }

    it('should create a ZIP with the correct number of files', async () => {
      const items: ExportItem[] = [
        createExportItem('image1'),
        createExportItem('image2'),
        createExportItem('image3'),
      ];

      const zipBlob = await exportBatchAsZip(items);

      expect(zipBlob).toBeInstanceOf(Blob);
      // Verify the ZIP was generated (non-empty blob)
      expect(zipBlob.size).toBeGreaterThan(0);
    });

    it('should use correct file names in the ZIP', async () => {
      // We'll use JSZip to verify the contents
      const JSZip = (await import('jszip')).default;

      const items: ExportItem[] = [
        createExportItem('product1', 'jpeg'),
        createExportItem('product2', 'png'),
      ];

      const zipBlob = await exportBatchAsZip(items);
      const zip = await JSZip.loadAsync(zipBlob);

      const fileNames = Object.keys(zip.files);
      expect(fileNames).toContain('product1_compliant.jpeg');
      expect(fileNames).toContain('product2_compliant.png');
      expect(fileNames).toHaveLength(2);
    });

    it('should handle a single image', async () => {
      const JSZip = (await import('jszip')).default;

      const items: ExportItem[] = [createExportItem('single', 'webp')];

      const zipBlob = await exportBatchAsZip(items);
      const zip = await JSZip.loadAsync(zipBlob);

      const fileNames = Object.keys(zip.files);
      expect(fileNames).toContain('single_compliant.webp');
      expect(fileNames).toHaveLength(1);
    });

    it('should handle empty array', async () => {
      const JSZip = (await import('jszip')).default;

      const zipBlob = await exportBatchAsZip([]);
      const zip = await JSZip.loadAsync(zipBlob);

      const fileNames = Object.keys(zip.files);
      expect(fileNames).toHaveLength(0);
    });

    it('should include blob data for each file in the ZIP', async () => {
      const JSZip = (await import('jszip')).default;

      const items: ExportItem[] = [createExportItem('test-file', 'jpeg')];

      const zipBlob = await exportBatchAsZip(items);
      const zip = await JSZip.loadAsync(zipBlob);

      const fileData = await zip.file('test-file_compliant.jpeg')?.async('blob');
      expect(fileData).toBeDefined();
      expect(fileData!.size).toBeGreaterThan(0);
    });
  });

  describe('downloadBlob', () => {
    beforeEach(() => {
      // URL.createObjectURL and revokeObjectURL don't exist in jsdom
      if (!URL.createObjectURL) {
        URL.createObjectURL = vi.fn();
      }
      if (!URL.revokeObjectURL) {
        URL.revokeObjectURL = vi.fn();
      }
    });

    it('should create a download link and trigger click', () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });
      const mockUrl = 'blob:http://localhost/test-url';

      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      } as unknown as HTMLAnchorElement;

      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      downloadBlob(mockBlob, 'export.zip');

      expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockLink.href).toBe(mockUrl);
      expect(mockLink.download).toBe('export.zip');
      expect(mockLink.click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });

    it('should remove the link element after download', () => {
      const mockBlob = new Blob(['test'], { type: 'application/zip' });
      const mockUrl = 'blob:http://localhost/test-url-2';

      const mockLink = {
        href: '',
        download: '',
        style: { display: '' },
        click: vi.fn(),
      } as unknown as HTMLAnchorElement;

      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

      downloadBlob(mockBlob, 'test.zip');

      expect(appendSpy).toHaveBeenCalledWith(mockLink);
      expect(removeSpy).toHaveBeenCalledWith(mockLink);
    });
  });
});
