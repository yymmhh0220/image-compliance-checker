import type {
  ComplianceReport,
  ComplianceRuleResult,
  SizeResult,
  BackgroundResult,
  CoverageResult,
  TextResult,
  MultiViewResult,
} from '../../types';

/**
 * 生成合规报告，汇总所有分析结果。
 *
 * 规则：
 * - 整体状态为"合规"当且仅当所有规则均通过
 * - 每个不合规项附带非空的修改建议
 * - 标记可自动修正的项目（autoFixable）
 * - 使用绿色/红色标识区分合规/不合规项（通过 status 字段 'pass'/'fail'）
 *
 * @param imageId - 图片唯一标识
 * @param sizeResult - 尺寸分析结果
 * @param backgroundResult - 背景颜色分析结果
 * @param coverageResult - 商品占比分析结果
 * @param textResult - 文字和标记检测结果
 * @param multiViewResult - 多视图检测结果
 * @returns ComplianceReport 合规报告
 */
export function generateReport(
  imageId: string,
  sizeResult: SizeResult,
  backgroundResult: BackgroundResult,
  coverageResult: CoverageResult,
  textResult: TextResult,
  multiViewResult: MultiViewResult
): ComplianceReport {
  const rules: ComplianceRuleResult[] = [
    buildSizeRule(sizeResult),
    buildBackgroundRule(backgroundResult),
    buildCoverageRule(coverageResult),
    buildTextRule(textResult),
    buildMultiViewRule(multiViewResult),
  ];

  const overallStatus: 'compliant' | 'non-compliant' = rules.every(
    (rule) => rule.status === 'pass'
  )
    ? 'compliant'
    : 'non-compliant';

  return {
    imageId,
    overallStatus,
    timestamp: Date.now(),
    rules,
  };
}

function buildSizeRule(result: SizeResult): ComplianceRuleResult {
  const status = result.isCompliant ? 'pass' : 'fail';
  const details = `图片尺寸 ${result.width}×${result.height}，最长边 ${result.longEdge}px`;

  return {
    ruleId: 'size',
    ruleName: '图片尺寸',
    status,
    details,
    suggestion: status === 'fail' ? '请将图片最长边调整至1000像素以上' : undefined,
    autoFixable: true,
  };
}

function buildBackgroundRule(result: BackgroundResult): ComplianceRuleResult {
  const status = result.isCompliant ? 'pass' : 'fail';
  const { r, g, b } = result.averageRGB;
  const details = `背景平均RGB(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})，最大偏差 ${result.maxDeviation.toFixed(1)}`;

  return {
    ruleId: 'background',
    ruleName: '背景颜色',
    status,
    details,
    suggestion: status === 'fail' ? '请将背景替换为纯白色(RGB 255,255,255)' : undefined,
    autoFixable: true,
  };
}

function buildCoverageRule(result: CoverageResult): ComplianceRuleResult {
  const status = result.isCompliant ? 'pass' : 'fail';
  const details = `商品占比 ${result.coveragePercentage.toFixed(1)}%${result.isCropped ? '，商品被裁切' : ''}`;

  return {
    ruleId: 'coverage',
    ruleName: '商品占比',
    status,
    details,
    suggestion: status === 'fail' ? '请裁剪多余白色区域使商品占比达到85%以上' : undefined,
    autoFixable: true,
  };
}

function buildTextRule(result: TextResult): ComplianceRuleResult {
  const status = result.isCompliant ? 'pass' : 'fail';
  const violations: string[] = [];
  if (result.hasText) violations.push('文字');
  if (result.hasURL) violations.push('URL');
  if (result.hasPrice) violations.push('价格');
  if (result.hasQRCode) violations.push('二维码');
  if (result.hasLogo) violations.push('Logo/水印');

  const details =
    violations.length > 0
      ? `检测到违规元素：${violations.join('、')}`
      : '未检测到违规文字或标记';

  return {
    ruleId: 'text',
    ruleName: '文字和标记',
    status,
    details,
    suggestion: status === 'fail' ? '请手动移除图片中的文字、URL、价格等违规元素' : undefined,
    autoFixable: false,
    violations: result.detectedItems.map((item) => ({
      type: item.type,
      label: item.text,
      boundingBox: item.boundingBox,
    })),
  };
}

function buildMultiViewRule(result: MultiViewResult): ComplianceRuleResult {
  const status = result.isCompliant ? 'pass' : 'fail';
  const details = result.hasMultipleViews
    ? `检测到 ${result.viewCount} 个独立视图`
    : '单一视角，合规';

  return {
    ruleId: 'multiView',
    ruleName: '多视图检测',
    status,
    details,
    suggestion: status === 'fail' ? '请确保主图只展示商品的单一视角' : undefined,
    autoFixable: false,
  };
}
