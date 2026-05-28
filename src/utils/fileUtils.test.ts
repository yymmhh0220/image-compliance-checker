import { describe, it, expect } from 'vitest';
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_BATCH_SIZE,
  validateFileFormat,
  validateFileSize,
  validateBatchFiles,
} from './fileUtils';

function createMockFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(Math.min(size, 1024)); // Don't allocate huge buffers
  const file = new File([content], name, { type });
  // Override size since File constructor may not respect the full size
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('fileUtils', () => {
  describe('constants', () => {
    it('should have correct accepted MIME types', () => {
      expect(ACCEPTED_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    });

    it('should have MAX_FILE_SIZE as 20MB', () => {
      expect(MAX_FILE_SIZE).toBe(20 * 1024 * 1024);
    });

    it('should have MAX_BATCH_SIZE as 20', () => {
      expect(MAX_BATCH_SIZE).toBe(20);
    });
  });

  describe('validateFileFormat', () => {
    it('should accept JPEG files', () => {
      const file = createMockFile('test.jpg', 1000, 'image/jpeg');
      expect(validateFileFormat(file)).toBe(true);
    });

    it('should accept PNG files', () => {
      const file = createMockFile('test.png', 1000, 'image/png');
      expect(validateFileFormat(file)).toBe(true);
    });

    it('should accept WebP files', () => {
      const file = createMockFile('test.webp', 1000, 'image/webp');
      expect(validateFileFormat(file)).toBe(true);
    });

    it('should reject GIF files', () => {
      const file = createMockFile('test.gif', 1000, 'image/gif');
      expect(validateFileFormat(file)).toBe(false);
    });

    it('should reject PDF files', () => {
      const file = createMockFile('test.pdf', 1000, 'application/pdf');
      expect(validateFileFormat(file)).toBe(false);
    });

    it('should reject files with empty type', () => {
      const file = createMockFile('test', 1000, '');
      expect(validateFileFormat(file)).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should accept files exactly at 20MB', () => {
      const file = createMockFile('test.jpg', MAX_FILE_SIZE, 'image/jpeg');
      expect(validateFileSize(file)).toBe(true);
    });

    it('should accept files smaller than 20MB', () => {
      const file = createMockFile('test.jpg', 1024, 'image/jpeg');
      expect(validateFileSize(file)).toBe(true);
    });

    it('should reject files larger than 20MB', () => {
      const file = createMockFile('test.jpg', MAX_FILE_SIZE + 1, 'image/jpeg');
      expect(validateFileSize(file)).toBe(false);
    });

    it('should accept zero-size files', () => {
      const file = createMockFile('test.jpg', 0, 'image/jpeg');
      expect(validateFileSize(file)).toBe(true);
    });
  });

  describe('validateBatchFiles', () => {
    it('should return all valid files when all pass validation', () => {
      const files = [
        createMockFile('a.jpg', 1000, 'image/jpeg'),
        createMockFile('b.png', 2000, 'image/png'),
        createMockFile('c.webp', 3000, 'image/webp'),
      ];

      const result = validateBatchFiles(files);
      expect(result.validFiles).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should filter out files with invalid format', () => {
      const files = [
        createMockFile('a.jpg', 1000, 'image/jpeg'),
        createMockFile('b.gif', 2000, 'image/gif'),
      ];

      const result = validateBatchFiles(files);
      expect(result.validFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toBe('invalid_format');
      expect(result.errors[0].fileName).toBe('b.gif');
    });

    it('should filter out files that are too large', () => {
      const files = [
        createMockFile('a.jpg', 1000, 'image/jpeg'),
        createMockFile('big.jpg', MAX_FILE_SIZE + 1, 'image/jpeg'),
      ];

      const result = validateBatchFiles(files);
      expect(result.validFiles).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toBe('file_too_large');
      expect(result.errors[0].fileName).toBe('big.jpg');
    });

    it('should limit batch to MAX_BATCH_SIZE and mark excess as batch_limit_exceeded', () => {
      const files = Array.from({ length: 25 }, (_, i) =>
        createMockFile(`file${i}.jpg`, 1000, 'image/jpeg')
      );

      const result = validateBatchFiles(files);
      expect(result.validFiles).toHaveLength(20);
      expect(result.errors).toHaveLength(5);
      result.errors.forEach((error) => {
        expect(error.reason).toBe('batch_limit_exceeded');
      });
    });

    it('should handle empty file list', () => {
      const result = validateBatchFiles([]);
      expect(result.validFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed valid and invalid files', () => {
      const files = [
        createMockFile('valid.jpg', 1000, 'image/jpeg'),
        createMockFile('invalid.gif', 1000, 'image/gif'),
        createMockFile('toobig.png', MAX_FILE_SIZE + 1, 'image/png'),
        createMockFile('valid2.webp', 5000, 'image/webp'),
      ];

      const result = validateBatchFiles(files);
      expect(result.validFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].reason).toBe('invalid_format');
      expect(result.errors[1].reason).toBe('file_too_large');
    });

    it('should prioritize format check over size check for invalid format files', () => {
      // A file with invalid format AND too large should get invalid_format error
      const file = createMockFile('bad.gif', MAX_FILE_SIZE + 1, 'image/gif');
      const result = validateBatchFiles([file]);
      expect(result.errors[0].reason).toBe('invalid_format');
    });
  });
});
