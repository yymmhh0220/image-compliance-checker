import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { UploadedImage } from '../../types';

export interface ImagePreviewProps {
  images: UploadedImage[];
  currentImageId: string | null;
  onSelectImage: (id: string) => void;
  isAnalyzing?: boolean;
}

/**
 * ImagePreview component - displays a large preview of the selected image
 * with a horizontal scrollable thumbnail strip for batch navigation.
 */
const ImagePreview: React.FC<ImagePreviewProps> = ({
  images,
  currentImageId,
  onSelectImage,
  isAnalyzing = false,
}) => {
  const { t } = useTranslation();

  const currentImage = images.find((img) => img.id === currentImageId) ?? null;

  return (
    <div className="flex flex-col w-full">
      {/* Main Preview Area */}
      <div className="relative flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden min-h-[300px] md:min-h-[400px]">
        {currentImage ? (
          <>
            <img
              src={currentImage.thumbnailUrl}
              alt={currentImage.fileName}
              className="max-w-full max-h-[400px] object-contain"
            />
            {/* Analyzing Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                <Spin
                  indicator={<LoadingOutlined className="text-3xl text-white" spin />}
                  tip={
                    <span className="text-white text-sm mt-2">
                      {t('common.analyzing', '分析中...')}
                    </span>
                  }
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-400 text-sm">
            {images.length > 0
              ? t('preview.selectImage', '请选择一张图片')
              : t('preview.noImages', '暂无图片')}
          </p>
        )}
      </div>

      {/* Thumbnail Strip */}
      {images.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onSelectImage(image.id)}
                className={`
                  flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all
                  focus:outline-none focus:ring-2 focus:ring-blue-400
                  ${
                    image.id === currentImageId
                      ? 'border-blue-500 ring-2 ring-blue-300 shadow-md'
                      : 'border-gray-200 hover:border-gray-400'
                  }
                `}
                title={image.fileName}
                aria-label={image.fileName}
                aria-pressed={image.id === currentImageId}
              >
                <img
                  src={image.thumbnailUrl}
                  alt={image.fileName}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePreview;
