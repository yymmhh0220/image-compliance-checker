// === 图片相关 ===

export interface UploadedImage {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  format: 'jpeg' | 'png' | 'webp';
  width: number;
  height: number;
  imageData: ImageData;
  thumbnailUrl: string;
  uploadStatus: 'pending' | 'success' | 'error';
  errorMessage?: string;
}

export interface SegmentationMask {
  width: number;
  height: number;
  data: Uint8Array; // 0 = 背景, 255 = 前景
}

// === 合规报告 ===

export interface ComplianceReport {
  imageId: string;
  overallStatus: 'compliant' | 'non-compliant';
  timestamp: number;
  rules: ComplianceRuleResult[];
}

export interface ComplianceRuleResult {
  ruleId: string;
  ruleName: string;
  status: 'pass' | 'fail';
  details: string;
  suggestion?: string;
  autoFixable: boolean;
  violations?: ViolationMarker[];
}

export type RuleId =
  | 'size'
  | 'background'
  | 'coverage'
  | 'text'
  | 'multiView';

// === 检测结果 ===

export interface SizeResult {
  width: number;
  height: number;
  longEdge: number;
  isCompliant: boolean;
}

export interface BackgroundResult {
  averageRGB: { r: number; g: number; b: number };
  maxDeviation: number;
  isCompliant: boolean;
  nonWhitePercentage: number;
}

export interface CoverageResult {
  coveragePercentage: number;
  isCompliant: boolean;
  isCropped: boolean;
  boundingBox: BoundingBox;
}

export interface TextResult {
  hasText: boolean;
  hasURL: boolean;
  hasPrice: boolean;
  hasQRCode: boolean;
  hasLogo: boolean;
  detectedItems: DetectedTextItem[];
  isCompliant: boolean;
}

export interface MultiViewResult {
  hasMultipleViews: boolean;
  viewCount: number;
  isCompliant: boolean;
}

// === 违规标记 ===

export interface ViolationMarker {
  type: 'text' | 'url' | 'price' | 'qrcode' | 'logo' | 'watermark';
  label: string;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedTextItem {
  text: string;
  type: 'text' | 'url' | 'price' | 'qrcode' | 'logo' | 'watermark';
  confidence: number;
  boundingBox: BoundingBox;
}

// === 修正相关 ===

export interface CorrectionResult {
  imageId: string;
  correctedImageData: ImageData;
  appliedCorrections: AppliedCorrection[];
  newReport: ComplianceReport;
}

export interface AppliedCorrection {
  ruleId: string;
  type: 'background' | 'size' | 'coverage';
  before: string; // 修正前描述
  after: string;  // 修正后描述
}

export interface CorrectedImage {
  imageId: string;
  originalFileName: string;
  imageData: ImageData;
  width: number;
  height: number;
}

// === 导出相关 ===

export type ExportFormat = 'jpeg' | 'png' | 'webp';

export interface ExportOptions {
  format: ExportFormat;
  quality: number;        // 1-100, 仅 JPEG/WebP
  fileName: string;
  preserveResolution: boolean;
}

export interface ExportItem {
  image: CorrectedImage;
  options: ExportOptions;
}

// === 编辑器相关 ===

export interface EditorState {
  tool: 'brush' | 'eraser' | 'smartFill';
  brushSize: number;
  zoom: number;
  panOffset: Point;
  history: EditAction[];
  historyIndex: number;
}

export interface EditAction {
  type: 'brush' | 'eraser' | 'smartFill';
  points: Point[];
  region?: Region;
  previousData: ImageData;
}

export interface Point {
  x: number;
  y: number;
}

export interface Region {
  points: Point[];
}

// === 上传错误 ===

export interface UploadError {
  fileName: string;
  reason: 'invalid_format' | 'file_too_large' | 'batch_limit_exceeded';
  message: string;
}

// === 状态管理 ===

export interface AppState {
  // 图片管理
  images: UploadedImage[];
  currentImageId: string | null;

  // 分割结果缓存
  segmentationMasks: Map<string, SegmentationMask>;

  // 合规报告
  reports: Map<string, ComplianceReport>;

  // 修正结果
  corrections: Map<string, CorrectedImage>;

  // 编辑器状态
  editorState: EditorState | null;

  // UI 状态
  isAnalyzing: boolean;
  isCorrecting: boolean;
  currentLanguage: 'zh' | 'ja' | 'en';

  // 操作方法
  uploadImages: (files: File[]) => Promise<void>;
  analyzeImage: (imageId: string) => Promise<void>;
  correctImage: (imageId: string, ruleId: string) => Promise<void>;
  correctAll: (imageId: string) => Promise<void>;
  exportImage: (imageId: string, options: ExportOptions) => Promise<void>;
  exportBatch: (options: ExportOptions) => Promise<void>;
}

// === 分析引擎接口 ===

export interface ImageAnalyzer {
  analyzeSize(imageData: ImageData): SizeResult;
  analyzeBackground(imageData: ImageData, mask: SegmentationMask): BackgroundResult;
  analyzeCoverage(imageData: ImageData, mask: SegmentationMask): CoverageResult;
  analyzeText(imageData: ImageData): Promise<TextResult>;
  analyzeMultiView(imageData: ImageData, mask: SegmentationMask): MultiViewResult;
}

// === 图像分割接口 ===

export interface SegmentationService {
  segment(imageData: ImageData): Promise<SegmentationMask>;
  initialize(): Promise<void>;
  isReady(): boolean;
}

// === 修正引擎接口 ===

export interface ImageCorrector {
  replaceBackground(imageData: ImageData, mask: SegmentationMask): ImageData;
  resizeImage(imageData: ImageData, targetLongEdge: number): ImageData;
  adjustCoverage(imageData: ImageData, mask: SegmentationMask, targetCoverage: number): ImageData;
  applyAllCorrections(imageData: ImageData, report: ComplianceReport): Promise<CorrectionResult>;
}

// === 编辑器接口 ===

export interface ManualEditor {
  applyBrush(canvas: HTMLCanvasElement, point: Point, brushSize: number): void;
  applyEraser(canvas: HTMLCanvasElement, point: Point, eraserSize: number): void;
  applySmartFill(canvas: HTMLCanvasElement, region: Region): void;
  undo(): void;
  redo(): void;
  getEditedImageData(): ImageData;
}

// === 导出接口 ===

export interface ImageExporter {
  exportAsJPEG(imageData: ImageData, quality: number): Blob;
  exportAsPNG(imageData: ImageData): Blob;
  exportAsWebP(imageData: ImageData, quality: number): Blob;
  exportBatchAsZip(images: ExportItem[]): Promise<Blob>;
  estimateFileSize(imageData: ImageData, format: ExportFormat, quality?: number): number;
}

// === 组件 Props 接口 ===

export interface UploadAreaProps {
  maxFiles: number;           // 最大文件数量 (20)
  maxFileSize: number;        // 最大文件大小 (20MB)
  acceptedFormats: string[];  // 支持的格式
  onUpload: (files: UploadedImage[]) => void;
  onError: (errors: UploadError[]) => void;
}

export interface ComplianceReportProps {
  report: ComplianceReport;
  onCorrectItem: (ruleId: string) => void;
  onCorrectAll: () => void;
  onManualEdit: () => void;
}

export interface EditorProps {
  imageData: ImageData;
  violations: ViolationMarker[];
  onSave: (editedImage: ImageData) => void;
  onCancel: () => void;
}

export interface ExportPanelProps {
  images: CorrectedImage[];
  onExport: (options: ExportOptions) => void;
}
