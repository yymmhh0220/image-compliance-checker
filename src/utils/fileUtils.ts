import { UploadError } from '../types';

// === Constants ===

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const MAX_BATCH_SIZE = 20;

// === Validation Functions ===

/**
 * 验证文件格式是否为支持的图片类型（JPEG、PNG、WebP）
 */
export function validateFileFormat(file: File): boolean {
  return ACCEPTED_MIME_TYPES.includes(file.type);
}

/**
 * 验证文件大小是否在限制范围内（≤ 20MB）
 */
export function validateFileSize(file: File): boolean {
  return file.size <= MAX_FILE_SIZE;
}

/**
 * 批量验证文件，返回有效文件列表和无效文件错误列表。
 * 如果文件总数超过 MAX_BATCH_SIZE，只取前 20 个文件进行验证，
 * 超出部分标记为 batch_limit_exceeded 错误。
 */
export function validateBatchFiles(files: File[]): {
  validFiles: File[];
  errors: UploadError[];
} {
  const validFiles: File[] = [];
  const errors: UploadError[] = [];

  // 处理前 MAX_BATCH_SIZE 个文件
  const filesToProcess = files.slice(0, MAX_BATCH_SIZE);
  const excessFiles = files.slice(MAX_BATCH_SIZE);

  for (const file of filesToProcess) {
    if (!validateFileFormat(file)) {
      errors.push({
        fileName: file.name,
        reason: 'invalid_format',
        message: `不支持的文件格式。支持的格式：JPEG、PNG、WebP`,
      });
    } else if (!validateFileSize(file)) {
      errors.push({
        fileName: file.name,
        reason: 'file_too_large',
        message: `文件大小超过 20MB 限制`,
      });
    } else {
      validFiles.push(file);
    }
  }

  // 超出批量限制的文件标记错误
  for (const file of excessFiles) {
    errors.push({
      fileName: file.name,
      reason: 'batch_limit_exceeded',
      message: `超出批量上传数量限制（最多 ${MAX_BATCH_SIZE} 张）`,
    });
  }

  return { validFiles, errors };
}
