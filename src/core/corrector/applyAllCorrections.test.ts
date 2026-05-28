import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComplianceReport, SegmentationMask } from '../../types';

// Mock the corrector modules to track call order and avoid Canvas dependency
const replaceBackgroundMock = vi.fn();
const resizeImageMock = vi.fn();
const adjustCoverageMock = vi.fn();

vi.mock('./backgroundCorrector', () => ({
  replaceBackground: (...args: unknown[]) => replaceBackgroundMock(...args),
}));

vi.mock('./sizeCorrector', () => ({
  resizeImage: (...args: unknown[]) => resizeImageMock(...args),
}));

vi.mock('./coverageCorrector', () => ({
  adjustCoverage: (...args: unknown[]) => adjustCoverageMock(...args),
  findForegroundBBox: vi.fn().mockReturnValue({ minX: 0, minY: 0, maxX: 9, maxY: 9 }),
  calculateCropArea: vi.fn().mockReturnValue({ x: 0, y: 0, width: 10, height: 10 }),
}));

// Mock the text analyzer since it uses Tesseract.js
vi.mock('../analyzer/textAnalyzer', () => ({
  analyzeText: vi.fn().mockResolvedValue({
    hasText: false,
    hasURL: false,
    hasPrice: false,
    hasQRCode: false,
    hasLogo: false,
    detectedItems: [],
    isCompliant: true,
  }),
}));

import { applyAllCorrections } from './applyAllCorrections';

/**
 * Helper to create an ImageData-compatible object for testing.
 */
function createImageData(width: number, height: number, data?: Uint8ClampedArray): ImageData {
  const pixelData = data ?? new Uint8ClampedArray(width * height * 4).fill(255);
  return { width, height, data: pixelData, colorSpace: 'srgb' } as ImageData;
}

/**
 * Helper to create a SegmentationMask.
 */
function createMask(width: number, height: number, maskValues?: number[]): SegmentationMask {
  const data = maskValues
    ? new Uint8Array(maskValues)
    : new Uint8Array(width * height).fill(255);
  return { width, height, data };
}

/**
 * Create a report with specified failing rules.
 */
function createReport(
  imageId: string,
  failingRules: Array<{ ruleId: string; autoFixable: boolean; details?: string }>
): ComplianceReport {
  const allRuleIds = ['size', 'background', 'coverage', 'text', 'multiView'];
  const rules = allRuleIds.map((ruleId) => {
    const failing = failingRules.find((r) => r.ruleId === ruleId);
    return {
      ruleId,
      ruleName: ruleId,
      status: failing ? ('fail' as const) : ('pass' as const),
      details: failing?.details ?? `${ruleId} details`,
      suggestion: failing ? `Fix ${ruleId}` : undefined,
      autoFixable: failing?.autoFixable ?? (ruleId === 'background' || ruleId === 'size' || ruleId === 'coverage'),
    };
  });

  return {
    imageId,
    overallStatus: failingRules.length > 0 ? 'non-compliant' : 'compliant',
    timestamp: Date.now(),
    rules,
  };
}

describe('applyAllCorrections', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations: return the same image data passed in
    replaceBackgroundMock.mockImplementation((imageData: ImageData) => imageData);
    resizeImageMock.mockImplementation((imageData: ImageData) => imageData);
    adjustCoverageMock.mockImplementation((imageData: ImageData) => imageData);
  });

  it('should return empty corrections list when no rules are failing', async () => {
    const imageData = createImageData(1000, 1000);
    const mask = createMask(1000, 1000);
    const report = createReport('img-1', []);

    const result = await applyAllCorrections(imageData, mask, report);

    expect(result.appliedCorrections).toHaveLength(0);
    expect(result.imageId).toBe('img-1');
    expect(replaceBackgroundMock).not.toHaveBeenCalled();
    expect(resizeImageMock).not.toHaveBeenCalled();
    expect(adjustCoverageMock).not.toHaveBeenCalled();
  });

  it('should only apply background correction when only background fails', async () => {
    const imageData = createImageData(1000, 1000);
    const mask = createMask(1000, 1000);
    const report = createReport('img-2', [
      { ruleId: 'background', autoFixable: true, details: '背景平均RGB(200, 200, 200)' },
    ]);

    const result = await applyAllCorrections(imageData, mask, report);

    expect(result.appliedCorrections).toHaveLength(1);
    expect(result.appliedCorrections[0].type).toBe('background');
    expect(result.appliedCorrections[0].ruleId).toBe('background');
    expect(replaceBackgroundMock).toHaveBeenCalledOnce();
    expect(resizeImageMock).not.toHaveBeenCalled();
    expect(adjustCoverageMock).not.toHaveBeenCalled();
  });

  it('should apply corrections in fixed order: background → size → coverage', async () => {
    const callOrder: string[] = [];

    replaceBackgroundMock.mockImplementation((imageData: ImageData) => {
      callOrder.push('background');
      return imageData;
    });
    resizeImageMock.mockImplementation((imageData: ImageData) => {
      callOrder.push('size');
      return imageData;
    });
    adjustCoverageMock.mockImplementation((imageData: ImageData) => {
      callOrder.push('coverage');
      return imageData;
    });

    const imageData = createImageData(100, 50);
    const mask = createMask(100, 50);
    const report = createReport('img-3', [
      { ruleId: 'background', autoFixable: true, details: '背景不合规' },
      { ruleId: 'size', autoFixable: true, details: '尺寸不合规' },
      { ruleId: 'coverage', autoFixable: true, details: '商品占比不足' },
    ]);

    const result = await applyAllCorrections(imageData, mask, report);

    // All three corrections should be applied
    expect(result.appliedCorrections).toHaveLength(3);

    // Verify the order of corrections in the result
    expect(result.appliedCorrections[0].type).toBe('background');
    expect(result.appliedCorrections[1].type).toBe('size');
    expect(result.appliedCorrections[2].type).toBe('coverage');

    // Verify the actual call order of the corrector functions
    expect(callOrder).toEqual(['background', 'size', 'coverage']);
  });

  it('should not apply corrections for non-autoFixable rules', async () => {
    const imageData = createImageData(1000, 1000);
    const mask = createMask(1000, 1000);

    // Text rule is not autoFixable
    const report = createReport('img-4', [
      { ruleId: 'text', autoFixable: false, details: '检测到文字' },
    ]);

    const result = await applyAllCorrections(imageData, mask, report);

    expect(result.appliedCorrections).toHaveLength(0);
    expect(replaceBackgroundMock).not.toHaveBeenCalled();
    expect(resizeImageMock).not.toHaveBeenCalled();
    expect(adjustCoverageMock).not.toHaveBeenCalled();
  });

  it('should generate a new compliance report after corrections', async () => {
    const imageData = createImageData(1000, 1000);
    const mask = createMask(1000, 1000, new Array(1000 * 1000).fill(0));
    const report = createReport('img-5', [
      { ruleId: 'background', autoFixable: true, details: '背景不合规' },
    ]);

    // Mock replaceBackground to return white image
    const whiteData = new Uint8ClampedArray(1000 * 1000 * 4).fill(255);
    replaceBackgroundMock.mockReturnValue(createImageData(1000, 1000, whiteData));

    const result = await applyAllCorrections(imageData, mask, report);

    // Should have a new report
    expect(result.newReport).toBeDefined();
    expect(result.newReport.imageId).toBe('img-5');
    expect(result.newReport.rules).toHaveLength(5);
    // Background should now be compliant after replacement (all background pixels are white)
    const bgRule = result.newReport.rules.find((r) => r.ruleId === 'background');
    expect(bgRule?.status).toBe('pass');
  });

  it('should pass correct arguments to each corrector', async () => {
    const imageData = createImageData(100, 50);
    const mask = createMask(100, 50);
    const report = createReport('img-6', [
      { ruleId: 'background', autoFixable: true },
      { ruleId: 'size', autoFixable: true },
      { ruleId: 'coverage', autoFixable: true },
    ]);

    await applyAllCorrections(imageData, mask, report);

    // Background corrector receives imageData and mask
    expect(replaceBackgroundMock).toHaveBeenCalledWith(imageData, mask);

    // Size corrector receives imageData and target 1000
    expect(resizeImageMock).toHaveBeenCalledWith(imageData, 1000);

    // Coverage corrector receives imageData, mask, and target 85
    expect(adjustCoverageMock).toHaveBeenCalledWith(imageData, expect.anything(), 85);
  });

  it('should chain corrections - each step receives output of previous step', async () => {
    const originalImage = createImageData(100, 50);
    const afterBackground = createImageData(100, 50);
    const afterSize = createImageData(1000, 500);
    const afterCoverage = createImageData(900, 450);

    replaceBackgroundMock.mockReturnValue(afterBackground);
    resizeImageMock.mockReturnValue(afterSize);
    adjustCoverageMock.mockReturnValue(afterCoverage);

    const mask = createMask(100, 50);
    const report = createReport('img-7', [
      { ruleId: 'background', autoFixable: true },
      { ruleId: 'size', autoFixable: true },
      { ruleId: 'coverage', autoFixable: true },
    ]);

    const result = await applyAllCorrections(originalImage, mask, report);

    // Background receives original
    expect(replaceBackgroundMock).toHaveBeenCalledWith(originalImage, mask);

    // Size receives output of background step
    expect(resizeImageMock).toHaveBeenCalledWith(afterBackground, 1000);

    // Final corrected image is the output of the last step
    expect(result.correctedImageData).toBe(afterCoverage);
  });

  it('should include before/after descriptions in applied corrections', async () => {
    const imageData = createImageData(100, 50);
    const mask = createMask(100, 50);
    const report = createReport('img-8', [
      { ruleId: 'background', autoFixable: true, details: '背景平均RGB(200, 200, 200)，最大偏差 55.0' },
    ]);

    const result = await applyAllCorrections(imageData, mask, report);

    expect(result.appliedCorrections[0].before).toBe('背景平均RGB(200, 200, 200)，最大偏差 55.0');
    expect(result.appliedCorrections[0].after).toContain('纯白色');
  });

  it('should handle report with only size failing', async () => {
    const imageData = createImageData(500, 300);
    const mask = createMask(500, 300);
    const report = createReport('img-9', [
      { ruleId: 'size', autoFixable: true, details: '图片尺寸 500×300，最长边 500px' },
    ]);

    const result = await applyAllCorrections(imageData, mask, report);

    expect(result.appliedCorrections).toHaveLength(1);
    expect(result.appliedCorrections[0].type).toBe('size');
    expect(replaceBackgroundMock).not.toHaveBeenCalled();
    expect(resizeImageMock).toHaveBeenCalledOnce();
    expect(adjustCoverageMock).not.toHaveBeenCalled();
  });
});
