import React, { useState, useMemo, useCallback } from 'react';
import { Radio, Slider, Input, Button, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CorrectedImage, ExportFormat, ExportOptions } from '../../types';
import {
  estimateFileSize,
  generateDefaultFileName,
  exportImage,
  exportBatchAsZip,
  downloadBlob,
} from '../../core/exporter/imageExporter';

export interface ExportPanelProps {
  images: CorrectedImage[];
  onExport: (options: ExportOptions) => void;
}

/**
 * Format bytes into a human-readable string (e.g., "1.2 MB").
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ images, onExport }) => {
  const { t } = useTranslation();

  const [format, setFormat] = useState<ExportFormat>('jpeg');
  const [quality, setQuality] = useState<number>(90);
  const [fileName, setFileName] = useState<string>(() => {
    if (images.length > 0) {
      return generateDefaultFileName(images[0].originalFileName, 'jpeg');
    }
    return 'image_compliant.jpeg';
  });
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [lastExportedBlob, setLastExportedBlob] = useState<Blob | null>(null);
  const [lastExportedFileName, setLastExportedFileName] = useState<string>('');

  const showQualitySlider = format !== 'png';

  // Update fileName when format changes
  const handleFormatChange = useCallback(
    (newFormat: ExportFormat) => {
      setFormat(newFormat);
      if (images.length > 0) {
        setFileName(generateDefaultFileName(images[0].originalFileName, newFormat));
      }
      setExportSuccess(false);
    },
    [images]
  );

  // Estimated file size for the first image
  const estimatedSize = useMemo(() => {
    if (images.length === 0) return 0;
    return estimateFileSize(images[0].imageData, format, quality);
  }, [images, format, quality]);

  const handleExport = useCallback(async () => {
    if (images.length === 0) return;

    setExporting(true);
    setExportSuccess(false);

    try {
      const options: ExportOptions = {
        format,
        quality,
        fileName,
        preserveResolution: true,
      };

      const blob = await exportImage(images[0].imageData, options);
      downloadBlob(blob, fileName);

      setLastExportedBlob(blob);
      setLastExportedFileName(fileName);
      setExportSuccess(true);
      onExport(options);
    } finally {
      setExporting(false);
    }
  }, [images, format, quality, fileName, onExport]);

  const handleBatchExport = useCallback(async () => {
    if (images.length === 0) return;

    setExporting(true);
    setExportSuccess(false);

    try {
      const exportItems = images.map((image) => ({
        image,
        options: {
          format,
          quality,
          fileName: generateDefaultFileName(image.originalFileName, format),
          preserveResolution: true,
        },
      }));

      const zipBlob = await exportBatchAsZip(exportItems);
      downloadBlob(zipBlob, 'images_compliant.zip');

      setLastExportedBlob(zipBlob);
      setLastExportedFileName('images_compliant.zip');
      setExportSuccess(true);
      onExport({ format, quality, fileName, preserveResolution: true });
    } finally {
      setExporting(false);
    }
  }, [images, format, quality, fileName, onExport]);

  const handleDownloadAgain = useCallback(() => {
    if (lastExportedBlob && lastExportedFileName) {
      downloadBlob(lastExportedBlob, lastExportedFileName);
    }
  }, [lastExportedBlob, lastExportedFileName]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm space-y-6">
      <h3 className="text-lg font-semibold">{t('export.title')}</h3>

      {/* Format selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('export.format')}
        </label>
        <Radio.Group
          value={format}
          onChange={(e) => handleFormatChange(e.target.value)}
        >
          <Radio value="jpeg">JPEG</Radio>
          <Radio value="png">PNG</Radio>
          <Radio value="webp">WebP</Radio>
        </Radio.Group>
      </div>

      {/* Quality slider (only for JPEG/WebP) */}
      {showQualitySlider && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t('export.quality')}: {quality}
          </label>
          <Slider
            min={1}
            max={100}
            value={quality}
            onChange={(value) => {
              setQuality(value);
              setExportSuccess(false);
            }}
          />
        </div>
      )}

      {/* File name input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('export.fileName')}
        </label>
        <Input
          value={fileName}
          onChange={(e) => {
            setFileName(e.target.value);
            setExportSuccess(false);
          }}
        />
      </div>

      {/* Estimated file size */}
      <div className="space-y-1">
        <span className="text-sm text-gray-500">
          {t('export.estimatedSize')}: {formatFileSize(estimatedSize)}
        </span>
      </div>

      {/* Export buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button
          type="primary"
          loading={exporting}
          onClick={handleExport}
          disabled={images.length === 0}
        >
          {t('export.exportButton')}
        </Button>

        {images.length > 1 && (
          <Button
            loading={exporting}
            onClick={handleBatchExport}
          >
            {t('export.batchExport')}
          </Button>
        )}
      </div>

      {/* Success message with download link */}
      {exportSuccess && (
        <Alert
          type="success"
          message={t('export.success')}
          description={
            <Button type="link" onClick={handleDownloadAgain} className="p-0">
              {t('common.download')}
            </Button>
          }
          showIcon
        />
      )}
    </div>
  );
};

export default ExportPanel;
