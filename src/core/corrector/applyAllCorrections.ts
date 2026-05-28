import type {
  ComplianceReport,
  CorrectionResult,
  AppliedCorrection,
  SegmentationMask,
} from '../../types';
import { replaceBackground } from './backgroundCorrector';
import { resizeImage } from './sizeCorrector';
import { adjustCoverage, findForegroundBBox, calculateCropArea } from './coverageCorrector';
import { analyzeSize } from '../analyzer/sizeAnalyzer';
import { analyzeBackground } from '../analyzer/backgroundAnalyzer';
import { analyzeCoverage } from '../analyzer/coverageAnalyzer';
import { analyzeText } from '../analyzer/textAnalyzer';
import { analyzeMultiView } from '../analyzer/multiViewAnalyzer';
import { generateReport } from '../analyzer/reportGenerator';

/**
 * 一键修正功能：按固定顺序执行所有可自动修正的不合规项。
 *
 * 执行顺序：背景替换 → 尺寸调整 → 占比调整
 *
 * 修正完成后重新执行合规检测并生成新的 ComplianceReport。
 *
 * @param imageData - 原始图片数据
 * @param mask - 分割掩码（0=背景, 255=前景）
 * @param report - 当前合规报告（用于判断哪些项需要修正）
 * @returns CorrectionResult 包含修正后图片、应用的修正列表和新报告
 */
export async function applyAllCorrections(
  imageData: ImageData,
  mask: SegmentationMask,
  report: ComplianceReport
): Promise<CorrectionResult> {
  let currentImageData = imageData;
  let currentMask = mask;
  const appliedCorrections: AppliedCorrection[] = [];

  // Determine which rules failed and are autoFixable
  const failedRules = report.rules.filter(
    (rule) => rule.status === 'fail' && rule.autoFixable
  );

  const needsBackgroundFix = failedRules.some((r) => r.ruleId === 'background');
  const needsSizeFix = failedRules.some((r) => r.ruleId === 'size');
  const needsCoverageFix = failedRules.some((r) => r.ruleId === 'coverage');

  // Step 1: Background replacement
  if (needsBackgroundFix) {
    const backgroundRule = report.rules.find((r) => r.ruleId === 'background');
    const beforeDetails = backgroundRule?.details ?? '背景不合规';

    currentImageData = replaceBackground(currentImageData, currentMask);

    appliedCorrections.push({
      ruleId: 'background',
      type: 'background',
      before: beforeDetails,
      after: '背景已替换为纯白色(RGB 255,255,255)',
    });
  }

  // Step 2: Size adjustment
  if (needsSizeFix) {
    const sizeRule = report.rules.find((r) => r.ruleId === 'size');
    const beforeDetails = sizeRule?.details ?? '尺寸不合规';

    currentImageData = resizeImage(currentImageData, 1000);

    // After resizing, the mask dimensions also need to be updated
    // Resize the mask to match the new image dimensions
    currentMask = resizeMask(currentMask, currentImageData.width, currentImageData.height);

    appliedCorrections.push({
      ruleId: 'size',
      type: 'size',
      before: beforeDetails,
      after: `尺寸已调整为 ${currentImageData.width}×${currentImageData.height}，最长边 ${Math.max(currentImageData.width, currentImageData.height)}px`,
    });
  }

  // Step 3: Coverage adjustment
  if (needsCoverageFix) {
    const coverageRule = report.rules.find((r) => r.ruleId === 'coverage');
    const beforeDetails = coverageRule?.details ?? '商品占比不足';

    currentImageData = adjustCoverage(currentImageData, currentMask, 85);

    // After cropping, update the mask to match new dimensions
    currentMask = cropMask(currentMask, currentImageData.width, currentImageData.height, imageData.width);

    appliedCorrections.push({
      ruleId: 'coverage',
      type: 'coverage',
      before: beforeDetails,
      after: '商品占比已调整至85%以上',
    });
  }

  // Re-run analysis on the corrected image
  const newReport = await runFullAnalysis(currentImageData, currentMask, report.imageId);

  return {
    imageId: report.imageId,
    correctedImageData: currentImageData,
    appliedCorrections,
    newReport,
  };
}

/**
 * Re-run full compliance analysis on the corrected image.
 */
async function runFullAnalysis(
  imageData: ImageData,
  mask: SegmentationMask,
  imageId: string
): Promise<ComplianceReport> {
  const sizeResult = analyzeSize(imageData);
  const backgroundResult = analyzeBackground(imageData, mask);
  const coverageResult = analyzeCoverage(imageData, mask);
  const textResult = await analyzeText(imageData);
  const multiViewResult = analyzeMultiView(imageData, mask);

  return generateReport(
    imageId,
    sizeResult,
    backgroundResult,
    coverageResult,
    textResult,
    multiViewResult
  );
}

/**
 * Resize a segmentation mask to new dimensions using nearest-neighbor interpolation.
 * Used after image resize to keep mask in sync with image dimensions.
 */
function resizeMask(
  mask: SegmentationMask,
  newWidth: number,
  newHeight: number
): SegmentationMask {
  if (mask.width === newWidth && mask.height === newHeight) {
    return mask;
  }

  const newData = new Uint8Array(newWidth * newHeight);
  const xRatio = mask.width / newWidth;
  const yRatio = mask.height / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = srcY * mask.width + srcX;
      const dstIdx = y * newWidth + x;
      newData[dstIdx] = mask.data[srcIdx];
    }
  }

  return { width: newWidth, height: newHeight, data: newData };
}

/**
 * Crop a mask to match the new image dimensions after coverage adjustment.
 * The coverage corrector crops the image, so we need to crop the mask similarly.
 * Since we don't know the exact crop offset, we re-derive it from the mask's foreground bbox.
 */
function cropMask(
  mask: SegmentationMask,
  newWidth: number,
  newHeight: number,
  _originalWidth: number
): SegmentationMask {
  // If dimensions haven't changed, return as-is
  if (mask.width === newWidth && mask.height === newHeight) {
    return mask;
  }

  // The coverage corrector crops around the foreground.
  // We need to find the same crop region in the mask.
  const bbox = findForegroundBBox(mask);
  if (!bbox) {
    return { width: newWidth, height: newHeight, data: new Uint8Array(newWidth * newHeight) };
  }

  let foregroundCount = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] === 255) foregroundCount++;
  }

  const cropArea = calculateCropArea(mask.width, mask.height, bbox, foregroundCount, 85);

  // Extract the cropped mask data
  const croppedData = new Uint8Array(cropArea.width * cropArea.height);
  for (let y = 0; y < cropArea.height; y++) {
    for (let x = 0; x < cropArea.width; x++) {
      const srcIdx = (cropArea.y + y) * mask.width + (cropArea.x + x);
      const dstIdx = y * cropArea.width + x;
      croppedData[dstIdx] = mask.data[srcIdx];
    }
  }

  return { width: cropArea.width, height: cropArea.height, data: croppedData };
}
