import { useState, useCallback, useEffect } from 'react';
import { ConfigProvider, message } from 'antd';
import { useTranslation } from 'react-i18next';

// Layout
import AppLayout from './components/Layout/AppLayout';

// Components
import UploadArea from './components/Upload/UploadArea';
import ImagePreview from './components/ImagePreview/ImagePreview';
import ComplianceReport from './components/Report/ComplianceReport';
import CorrectorPanel from './components/Corrector/CorrectorPanel';
import EditorCanvas from './components/Editor/EditorCanvas';
import ExportPanel from './components/Export/ExportPanel';

// Stores
import { useImageStore } from './store/imageStore';
import { useReportStore } from './store/reportStore';
import { useEditorStore } from './store/editorStore';

// Core modules
import { segmentationService, fallbackPixelAnalysis } from './core/segmentation/segmentationService';
import { analyzeSize } from './core/analyzer/sizeAnalyzer';
import { analyzeBackground } from './core/analyzer/backgroundAnalyzer';
import { analyzeCoverage } from './core/analyzer/coverageAnalyzer';
import { analyzeText } from './core/analyzer/textAnalyzer';
import { analyzeMultiView } from './core/analyzer/multiViewAnalyzer';
import { generateReport } from './core/analyzer/reportGenerator';
import { replaceBackground } from './core/corrector/backgroundCorrector';
import { resizeImage } from './core/corrector/sizeCorrector';
import { adjustCoverage } from './core/corrector/coverageCorrector';
import { applyAllCorrections } from './core/corrector/applyAllCorrections';
import { exportImage, downloadBlob, generateDefaultFileName } from './core/exporter/imageExporter';

// Types
import type { ComplianceReport as ComplianceReportType, SegmentationMask, ExportOptions, CorrectedImage, ViolationMarker } from './types';

/**
 * Application state phases representing the main workflow state machine:
 * idle → analyzing → reportReady → editing/exporting
 */
type AppPhase = 'idle' | 'analyzing' | 'reportReady' | 'editing' | 'exporting';

function App() {
  const { t } = useTranslation();

  // App state phase
  const [phase, setPhase] = useState<AppPhase>('idle');

  // Stores
  const {
    images,
    currentImageId,
    segmentationMasks,
    corrections,
    setCurrentImage,
    setSegmentationMask,
    setCorrectedImage,
  } = useImageStore();

  const {
    reports,
    isAnalyzing,
    setReport,
    setAnalyzing,
  } = useReportStore();

  const {
    isCorrecting,
    setCorrecting,
  } = useEditorStore();

  // Corrected image URL for before/after preview
  const [correctedImageUrl, setCorrectedImageUrl] = useState<string | undefined>(undefined);

  // Initialize segmentation service on mount
  useEffect(() => {
    segmentationService.initialize().catch((err) => {
      console.warn('Segmentation service initialization failed, using fallback:', err);
    });
  }, []);

  // Watch for new images being added and auto-trigger analysis
  useEffect(() => {
    if (images.length > 0 && !currentImageId) {
      const firstImage = images[0];
      setCurrentImage(firstImage.id);
      handleAnalyzeImage(firstImage.id);
    }
  }, [images.length]);

  /**
   * Run full compliance analysis on an image.
   * Uses segmentation service (fallback mode if model unavailable).
   */
  const handleAnalyzeImage = useCallback(async (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;

    setPhase('analyzing');
    setAnalyzing(true);

    try {
      // Step 1: Segmentation
      let mask: SegmentationMask;
      const existingMask = segmentationMasks.get(imageId);

      if (existingMask) {
        mask = existingMask;
      } else {
        try {
          mask = await segmentationService.segment(image.imageData);
        } catch {
          // Fallback to basic pixel analysis
          mask = fallbackPixelAnalysis(image.imageData);
        }
        setSegmentationMask(imageId, mask);
      }

      // Step 2: Run all analyzers
      const sizeResult = analyzeSize(image.imageData);
      const backgroundResult = analyzeBackground(image.imageData, mask);
      const coverageResult = analyzeCoverage(image.imageData, mask);
      const textResult = await analyzeText(image.imageData);
      const multiViewResult = analyzeMultiView(image.imageData, mask);

      // Step 3: Generate report
      const report = generateReport(
        imageId,
        sizeResult,
        backgroundResult,
        coverageResult,
        textResult,
        multiViewResult
      );

      setReport(imageId, report);
      setPhase('reportReady');
    } catch (error) {
      console.error('Analysis failed:', error);
      message.error(t('common.error'));
      setPhase('idle');
    } finally {
      setAnalyzing(false);
    }
  }, [images, segmentationMasks, setSegmentationMask, setReport, setAnalyzing, t]);

  /**
   * Handle correcting a single rule violation.
   */
  const handleCorrectItem = useCallback(async (ruleId: string) => {
    if (!currentImageId) return;

    const image = images.find((img) => img.id === currentImageId);
    const mask = segmentationMasks.get(currentImageId);
    if (!image || !mask) return;

    setCorrecting(true);

    try {
      let correctedData: ImageData;
      const sourceData = corrections.get(currentImageId)?.imageData ?? image.imageData;

      switch (ruleId) {
        case 'background':
          correctedData = replaceBackground(sourceData, mask);
          break;
        case 'size':
          correctedData = resizeImage(sourceData, 1000);
          break;
        case 'coverage':
          correctedData = adjustCoverage(sourceData, mask, 85);
          break;
        default:
          return;
      }

      // Store corrected image
      const corrected: CorrectedImage = {
        imageId: currentImageId,
        originalFileName: image.fileName,
        imageData: correctedData,
        width: correctedData.width,
        height: correctedData.height,
      };
      setCorrectedImage(currentImageId, corrected);

      // Generate preview URL
      updateCorrectedPreview(correctedData);

      // Re-analyze the corrected image
      await reAnalyze(currentImageId, correctedData);

      message.success(t('corrector.fixAll'));
    } catch (error) {
      console.error('Correction failed:', error);
      message.error(t('common.error'));
    } finally {
      setCorrecting(false);
    }
  }, [currentImageId, images, segmentationMasks, corrections, setCorrecting, setCorrectedImage, t]);

  /**
   * Handle correcting all auto-fixable violations at once.
   */
  const handleCorrectAll = useCallback(async () => {
    if (!currentImageId) return;

    const image = images.find((img) => img.id === currentImageId);
    const mask = segmentationMasks.get(currentImageId);
    const report = reports.get(currentImageId);
    if (!image || !mask || !report) return;

    setCorrecting(true);

    try {
      const sourceData = corrections.get(currentImageId)?.imageData ?? image.imageData;
      const result = await applyAllCorrections(sourceData, mask, report);

      // Store corrected image
      const corrected: CorrectedImage = {
        imageId: currentImageId,
        originalFileName: image.fileName,
        imageData: result.correctedImageData,
        width: result.correctedImageData.width,
        height: result.correctedImageData.height,
      };
      setCorrectedImage(currentImageId, corrected);

      // Update report
      setReport(currentImageId, result.newReport);

      // Generate preview URL
      updateCorrectedPreview(result.correctedImageData);

      message.success(t('corrector.fixAll'));
    } catch (error) {
      console.error('Correct all failed:', error);
      message.error(t('common.error'));
    } finally {
      setCorrecting(false);
    }
  }, [currentImageId, images, segmentationMasks, reports, corrections, setCorrecting, setCorrectedImage, setReport, t]);

  /**
   * Open the manual editor.
   */
  const handleManualEdit = useCallback(() => {
    setPhase('editing');
  }, []);

  /**
   * Handle saving from the editor - re-analyze the edited image.
   */
  const handleEditorSave = useCallback(async (editedImageData: ImageData) => {
    if (!currentImageId) return;

    const image = images.find((img) => img.id === currentImageId);
    if (!image) return;

    // Store the edited image as a correction
    const corrected: CorrectedImage = {
      imageId: currentImageId,
      originalFileName: image.fileName,
      imageData: editedImageData,
      width: editedImageData.width,
      height: editedImageData.height,
    };
    setCorrectedImage(currentImageId, corrected);

    // Update preview
    updateCorrectedPreview(editedImageData);

    // Re-analyze
    setPhase('analyzing');
    await reAnalyze(currentImageId, editedImageData);
    setPhase('reportReady');
  }, [currentImageId, images, setCorrectedImage]);

  /**
   * Handle canceling the editor.
   */
  const handleEditorCancel = useCallback(() => {
    setPhase('reportReady');
  }, []);

  /**
   * Switch to export phase.
   */
  const handleExport = useCallback(() => {
    setPhase('exporting');
  }, []);

  /**
   * Handle export completion.
   */
  const handleExportComplete = useCallback((_options: ExportOptions) => {
    // Stay in exporting phase - user can export again or go back
  }, []);

  /**
   * Handle downloading the corrected image from CorrectorPanel.
   */
  const handleDownload = useCallback(async () => {
    if (!currentImageId) return;

    const corrected = corrections.get(currentImageId);
    const image = images.find((img) => img.id === currentImageId);
    if (!corrected || !image) return;

    try {
      const options: ExportOptions = {
        format: image.format,
        quality: 90,
        fileName: generateDefaultFileName(image.fileName, image.format),
        preserveResolution: true,
      };
      const blob = await exportImage(corrected.imageData, options);
      downloadBlob(blob, options.fileName);
    } catch (error) {
      console.error('Download failed:', error);
      message.error(t('common.error'));
    }
  }, [currentImageId, corrections, images, t]);

  /**
   * Handle selecting an image from the thumbnail strip.
   */
  const handleSelectImage = useCallback((imageId: string) => {
    setCurrentImage(imageId);
    setCorrectedImageUrl(undefined);

    // If we already have a report for this image, show it
    if (reports.has(imageId)) {
      setPhase('reportReady');
      // If there's a corrected version, update preview
      const corrected = corrections.get(imageId);
      if (corrected) {
        updateCorrectedPreview(corrected.imageData);
      }
    } else {
      // Trigger analysis for this image
      handleAnalyzeImage(imageId);
    }
  }, [reports, corrections, handleAnalyzeImage, setCurrentImage]);

  /**
   * Re-analyze an image with given imageData (after correction/editing).
   */
  const reAnalyze = useCallback(async (imageId: string, imageData: ImageData) => {
    setAnalyzing(true);

    try {
      // Re-segment the corrected image
      let mask: SegmentationMask;
      try {
        mask = await segmentationService.segment(imageData);
      } catch {
        mask = fallbackPixelAnalysis(imageData);
      }
      setSegmentationMask(imageId, mask);

      // Run analyzers
      const sizeResult = analyzeSize(imageData);
      const backgroundResult = analyzeBackground(imageData, mask);
      const coverageResult = analyzeCoverage(imageData, mask);
      const textResult = await analyzeText(imageData);
      const multiViewResult = analyzeMultiView(imageData, mask);

      const report = generateReport(
        imageId,
        sizeResult,
        backgroundResult,
        coverageResult,
        textResult,
        multiViewResult
      );

      setReport(imageId, report);
      setPhase('reportReady');
    } catch (error) {
      console.error('Re-analysis failed:', error);
      message.error(t('common.error'));
    } finally {
      setAnalyzing(false);
    }
  }, [setAnalyzing, setSegmentationMask, setReport, t]);

  /**
   * Generate a preview URL from ImageData for the corrected image.
   */
  const updateCorrectedPreview = useCallback((imageData: ImageData) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
      const url = canvas.toDataURL('image/png');
      setCorrectedImageUrl(url);
    }
  }, []);

  // Derived state
  const currentImage = images.find((img) => img.id === currentImageId) ?? null;
  const currentReport: ComplianceReportType | undefined = currentImageId
    ? reports.get(currentImageId)
    : undefined;
  const currentCorrected = currentImageId ? corrections.get(currentImageId) : undefined;

  // Get violations for editor
  const editorViolations: ViolationMarker[] = currentReport
    ? currentReport.rules
        .filter((r) => r.status === 'fail' && r.violations)
        .flatMap((r) => r.violations ?? [])
    : [];

  // Get the image data for the editor (use corrected if available, otherwise original)
  const editorImageData = currentCorrected?.imageData ?? currentImage?.imageData;

  // Build list of corrected images for export panel
  const exportImages: CorrectedImage[] = currentImageId
    ? (() => {
        const corrected = corrections.get(currentImageId);
        if (corrected) return [corrected];
        if (currentImage) {
          return [{
            imageId: currentImage.id,
            originalFileName: currentImage.fileName,
            imageData: currentImage.imageData,
            width: currentImage.width,
            height: currentImage.height,
          }];
        }
        return [];
      })()
    : [];

  return (
    <ConfigProvider>
      <AppLayout>
        {/* Idle / Upload phase - always show upload area unless editing */}
        {phase !== 'editing' && (
          <div className="space-y-6">
            {/* Upload Area - always visible for adding more images */}
            {(phase === 'idle' || images.length === 0) && (
              <UploadArea />
            )}

            {/* Image Preview - shown when we have images */}
            {images.length > 0 && phase !== 'idle' && (
              <ImagePreview
                images={images}
                currentImageId={currentImageId}
                onSelectImage={handleSelectImage}
                isAnalyzing={isAnalyzing}
              />
            )}

            {/* Compliance Report - shown when report is ready */}
            {phase === 'reportReady' && currentReport && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ComplianceReport
                  report={currentReport}
                  onCorrectItem={handleCorrectItem}
                  onCorrectAll={handleCorrectAll}
                  onManualEdit={handleManualEdit}
                />

                <div className="space-y-4">
                  <CorrectorPanel
                    report={currentReport}
                    onCorrectBackground={() => handleCorrectItem('background')}
                    onCorrectSize={() => handleCorrectItem('size')}
                    onCorrectCoverage={() => handleCorrectItem('coverage')}
                    onCorrectAll={handleCorrectAll}
                    onManualEdit={handleManualEdit}
                    onDownload={handleDownload}
                    originalImageUrl={currentImage?.thumbnailUrl}
                    correctedImageUrl={correctedImageUrl}
                    isProcessing={isCorrecting}
                  />

                  {/* Export button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleExport}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      {t('export.title')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Export Panel - shown in exporting phase */}
            {phase === 'exporting' && exportImages.length > 0 && (
              <div className="space-y-4">
                <button
                  onClick={() => setPhase('reportReady')}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← {t('common.back')}
                </button>
                <ExportPanel
                  images={exportImages}
                  onExport={handleExportComplete}
                />
              </div>
            )}
          </div>
        )}

        {/* Editor - full screen when in editing phase */}
        {phase === 'editing' && editorImageData && (
          <div className="fixed inset-0 z-50 bg-white">
            <EditorCanvas
              imageData={editorImageData}
              violations={editorViolations}
              onSave={handleEditorSave}
              onCancel={handleEditorCancel}
            />
          </div>
        )}
      </AppLayout>
    </ConfigProvider>
  );
}

export default App;
