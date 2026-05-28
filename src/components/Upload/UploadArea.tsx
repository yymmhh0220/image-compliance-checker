import React, { useState, useCallback } from 'react';
import { Upload, Alert, message } from 'antd';
import { InboxOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useImageStore } from '../../store/imageStore';
import { validateBatchFiles, ACCEPTED_MIME_TYPES, MAX_BATCH_SIZE } from '../../utils/fileUtils';
import type { UploadedImage, UploadError } from '../../types';

const { Dragger } = Upload;

/**
 * Generate a unique ID for uploaded images
 */
function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine image format from MIME type
 */
function getFormatFromMime(mimeType: string): 'jpeg' | 'png' | 'webp' {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpeg';
}

/**
 * UploadArea component - provides drag-and-drop and click-to-select file upload
 * with validation, thumbnail preview, and status indicators.
 */
const UploadArea: React.FC = () => {
  const { t } = useTranslation();
  const { addImages, images } = useImageStore();
  const [errors, setErrors] = useState<UploadError[]>([]);

  const processFiles = useCallback(async (fileList: File[]) => {
    // Validate files using fileUtils
    const { validFiles, errors: validationErrors } = validateBatchFiles(fileList);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      validationErrors.forEach((err) => {
        if (err.reason === 'invalid_format') {
          message.error(`${err.fileName}: ${t('upload.formatError')}`);
        } else if (err.reason === 'file_too_large') {
          message.error(`${err.fileName}: ${t('upload.sizeError')}`);
        } else if (err.reason === 'batch_limit_exceeded') {
          message.error(`${err.fileName}: ${t('upload.batchLimitError')}`);
        }
      });
    }

    if (validFiles.length === 0) return;

    // Create UploadedImage objects for valid files
    const uploadedImages: UploadedImage[] = await Promise.all(
      validFiles.map(async (file) => {
        const id = generateId();
        const thumbnailUrl = URL.createObjectURL(file);

        // Load image to get dimensions
        const { width, height, imageData } = await loadImageData(file);

        return {
          id,
          file,
          fileName: file.name,
          fileSize: file.size,
          format: getFormatFromMime(file.type),
          width,
          height,
          imageData,
          thumbnailUrl,
          uploadStatus: 'success' as const,
        };
      })
    );

    addImages(uploadedImages);
    setErrors([]);
  }, [addImages, t]);

  const handleBeforeUpload = useCallback((_file: File, fileList: File[]) => {
    // We handle all files ourselves, prevent default upload behavior
    processFiles(fileList);
    return false; // Prevent default upload
  }, [processFiles]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Upload Dragger Area */}
      <Dragger
        multiple
        accept={ACCEPTED_MIME_TYPES.join(',')}
        showUploadList={false}
        beforeUpload={handleBeforeUpload}
        className="mb-4"
      >
        <p className="text-4xl text-gray-400 mb-2">
          <InboxOutlined />
        </p>
        <p className="text-base text-gray-700 font-medium">
          {t('upload.dragText')}
        </p>
        <p className="text-sm text-gray-500">
          {t('upload.clickText')}
        </p>
        <p className="text-xs text-gray-400 mt-2">
          {t('upload.supportedFormats')} | Max {MAX_BATCH_SIZE} {t('upload.title').toLowerCase()}
        </p>
      </Dragger>

      {/* Error Messages */}
      {errors.length > 0 && (
        <Alert
          type="error"
          closable
          onClose={() => setErrors([])}
          className="mb-4"
          message={t('common.error')}
          description={
            <ul className="list-disc pl-4 mt-1">
              {errors.map((err, index) => (
                <li key={index} className="text-sm">
                  <span className="font-medium">{err.fileName}</span>: {err.message}
                </li>
              ))}
            </ul>
          }
        />
      )}

      {/* Thumbnail List with Status */}
      {images.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            {t('upload.title')} ({images.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((image) => (
              <div
                key={image.id}
                className="relative group border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Thumbnail Image */}
                <div className="aspect-square relative">
                  <img
                    src={image.thumbnailUrl}
                    alt={image.fileName}
                    className="w-full h-full object-cover"
                  />
                  {/* Status Overlay */}
                  <div className="absolute top-1 right-1">
                    {image.uploadStatus === 'success' && (
                      <CheckCircleOutlined className="text-green-500 text-lg bg-white rounded-full" />
                    )}
                    {image.uploadStatus === 'error' && (
                      <CloseCircleOutlined className="text-red-500 text-lg bg-white rounded-full" />
                    )}
                    {image.uploadStatus === 'pending' && (
                      <LoadingOutlined className="text-blue-500 text-lg bg-white rounded-full" />
                    )}
                  </div>
                </div>
                {/* File Name */}
                <div className="p-1.5">
                  <p className="text-xs text-gray-600 truncate" title={image.fileName}>
                    {image.fileName}
                  </p>
                  {image.errorMessage && (
                    <p className="text-xs text-red-500 truncate" title={image.errorMessage}>
                      {image.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Load image file and extract dimensions and ImageData
 */
function loadImageData(file: File): Promise<{ width: number; height: number; imageData: ImageData }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height, imageData });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export default UploadArea;
