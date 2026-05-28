import { describe, it, expect } from 'vitest';
import { generateReport } from './reportGenerator';
import type {
  SizeResult,
  BackgroundResult,
  CoverageResult,
  TextResult,
  MultiViewResult,
} from '../../types';

// === Helper factories ===

function makeCompliantSizeResult(): SizeResult {
  return { width: 1200, height: 800, longEdge: 1200, isCompliant: true };
}

function makeNonCompliantSizeResult(): SizeResult {
  return { width: 500, height: 400, longEdge: 500, isCompliant: false };
}

function makeCompliantBackgroundResult(): BackgroundResult {
  return {
    averageRGB: { r: 254, g: 253, b: 252 },
    maxDeviation: 3,
    isCompliant: true,
    nonWhitePercentage: 2,
  };
}

function makeNonCompliantBackgroundResult(): BackgroundResult {
  return {
    averageRGB: { r: 200, g: 210, b: 220 },
    maxDeviation: 55,
    isCompliant: false,
    nonWhitePercentage: 45,
  };
}

function makeCompliantCoverageResult(): CoverageResult {
  return {
    coveragePercentage: 90,
    isCompliant: true,
    isCropped: false,
    boundingBox: { x: 10, y: 10, width: 80, height: 80 },
  };
}

function makeNonCompliantCoverageResult(): CoverageResult {
  return {
    coveragePercentage: 60,
    isCompliant: false,
    isCropped: false,
    boundingBox: { x: 20, y: 20, width: 60, height: 60 },
  };
}

function makeCompliantTextResult(): TextResult {
  return {
    hasText: false,
    hasURL: false,
    hasPrice: false,
    hasQRCode: false,
    hasLogo: false,
    detectedItems: [],
    isCompliant: true,
  };
}

function makeNonCompliantTextResult(): TextResult {
  return {
    hasText: true,
    hasURL: true,
    hasPrice: false,
    hasQRCode: false,
    hasLogo: false,
    detectedItems: [
      {
        text: 'https://example.com',
        type: 'url',
        confidence: 0.9,
        boundingBox: { x: 10, y: 10, width: 100, height: 20 },
      },
    ],
    isCompliant: false,
  };
}

function makeCompliantMultiViewResult(): MultiViewResult {
  return { hasMultipleViews: false, viewCount: 1, isCompliant: true };
}

function makeNonCompliantMultiViewResult(): MultiViewResult {
  return { hasMultipleViews: true, viewCount: 3, isCompliant: false };
}

// === Tests ===

describe('generateReport', () => {
  it('should return overall compliant when all rules pass', () => {
    const report = generateReport(
      'img-001',
      makeCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    expect(report.overallStatus).toBe('compliant');
    expect(report.imageId).toBe('img-001');
    expect(report.rules.every((r) => r.status === 'pass')).toBe(true);
  });

  it('should return overall non-compliant when one rule fails', () => {
    const report = generateReport(
      'img-002',
      makeNonCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    expect(report.overallStatus).toBe('non-compliant');
    const failedRules = report.rules.filter((r) => r.status === 'fail');
    expect(failedRules).toHaveLength(1);
    expect(failedRules[0].ruleId).toBe('size');
  });

  it('should return overall non-compliant when multiple rules fail', () => {
    const report = generateReport(
      'img-003',
      makeNonCompliantSizeResult(),
      makeNonCompliantBackgroundResult(),
      makeNonCompliantCoverageResult(),
      makeNonCompliantTextResult(),
      makeNonCompliantMultiViewResult()
    );

    expect(report.overallStatus).toBe('non-compliant');
    const failedRules = report.rules.filter((r) => r.status === 'fail');
    expect(failedRules).toHaveLength(5);
  });

  it('should include non-empty suggestions for all failed rules', () => {
    const report = generateReport(
      'img-004',
      makeNonCompliantSizeResult(),
      makeNonCompliantBackgroundResult(),
      makeNonCompliantCoverageResult(),
      makeNonCompliantTextResult(),
      makeNonCompliantMultiViewResult()
    );

    const failedRules = report.rules.filter((r) => r.status === 'fail');
    for (const rule of failedRules) {
      expect(rule.suggestion).toBeDefined();
      expect(rule.suggestion!.length).toBeGreaterThan(0);
    }
  });

  it('should not include suggestions for passing rules', () => {
    const report = generateReport(
      'img-005',
      makeCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    for (const rule of report.rules) {
      expect(rule.suggestion).toBeUndefined();
    }
  });

  it('should set correct autoFixable flags for each rule type', () => {
    const report = generateReport(
      'img-006',
      makeNonCompliantSizeResult(),
      makeNonCompliantBackgroundResult(),
      makeNonCompliantCoverageResult(),
      makeNonCompliantTextResult(),
      makeNonCompliantMultiViewResult()
    );

    const ruleMap = new Map(report.rules.map((r) => [r.ruleId, r]));

    // size, background, coverage are auto-fixable
    expect(ruleMap.get('size')!.autoFixable).toBe(true);
    expect(ruleMap.get('background')!.autoFixable).toBe(true);
    expect(ruleMap.get('coverage')!.autoFixable).toBe(true);

    // text and multiView are NOT auto-fixable
    expect(ruleMap.get('text')!.autoFixable).toBe(false);
    expect(ruleMap.get('multiView')!.autoFixable).toBe(false);
  });

  it('should include all 5 rules in the report', () => {
    const report = generateReport(
      'img-007',
      makeCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    expect(report.rules).toHaveLength(5);

    const ruleIds = report.rules.map((r) => r.ruleId);
    expect(ruleIds).toContain('size');
    expect(ruleIds).toContain('background');
    expect(ruleIds).toContain('coverage');
    expect(ruleIds).toContain('text');
    expect(ruleIds).toContain('multiView');
  });

  it('should include a timestamp', () => {
    const before = Date.now();
    const report = generateReport(
      'img-008',
      makeCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeCompliantMultiViewResult()
    );
    const after = Date.now();

    expect(report.timestamp).toBeGreaterThanOrEqual(before);
    expect(report.timestamp).toBeLessThanOrEqual(after);
  });

  it('should include specific suggestion text for size failure', () => {
    const report = generateReport(
      'img-009',
      makeNonCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    const sizeRule = report.rules.find((r) => r.ruleId === 'size')!;
    expect(sizeRule.suggestion).toBe('请将图片最长边调整至1000像素以上');
  });

  it('should include specific suggestion text for background failure', () => {
    const report = generateReport(
      'img-010',
      makeCompliantSizeResult(),
      makeNonCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    const bgRule = report.rules.find((r) => r.ruleId === 'background')!;
    expect(bgRule.suggestion).toBe('请将背景替换为纯白色(RGB 255,255,255)');
  });

  it('should include specific suggestion text for coverage failure', () => {
    const report = generateReport(
      'img-011',
      makeCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeNonCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    const coverageRule = report.rules.find((r) => r.ruleId === 'coverage')!;
    expect(coverageRule.suggestion).toBe('请裁剪多余白色区域使商品占比达到85%以上');
  });

  it('should include specific suggestion text for text failure', () => {
    const report = generateReport(
      'img-012',
      makeCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeNonCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    const textRule = report.rules.find((r) => r.ruleId === 'text')!;
    expect(textRule.suggestion).toBe('请手动移除图片中的文字、URL、价格等违规元素');
  });

  it('should include specific suggestion text for multiView failure', () => {
    const report = generateReport(
      'img-013',
      makeCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeCompliantTextResult(),
      makeNonCompliantMultiViewResult()
    );

    const mvRule = report.rules.find((r) => r.ruleId === 'multiView')!;
    expect(mvRule.suggestion).toBe('请确保主图只展示商品的单一视角');
  });

  it('should include violations from text result in the text rule', () => {
    const report = generateReport(
      'img-014',
      makeCompliantSizeResult(),
      makeCompliantBackgroundResult(),
      makeCompliantCoverageResult(),
      makeNonCompliantTextResult(),
      makeCompliantMultiViewResult()
    );

    const textRule = report.rules.find((r) => r.ruleId === 'text')!;
    expect(textRule.violations).toBeDefined();
    expect(textRule.violations!.length).toBeGreaterThan(0);
    expect(textRule.violations![0].type).toBe('url');
    expect(textRule.violations![0].label).toBe('https://example.com');
  });
});
