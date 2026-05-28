import React from 'react';
import { Card, Button, Space, Image, Typography } from 'antd';
import {
  BgColorsOutlined,
  ExpandOutlined,
  CompressOutlined,
  ThunderboltOutlined,
  EditOutlined,
  DownloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ComplianceReport } from '../../types';

const { Text } = Typography;

export interface CorrectorPanelProps {
  report: ComplianceReport;
  onCorrectBackground: () => void;
  onCorrectSize: () => void;
  onCorrectCoverage: () => void;
  onCorrectAll: () => void;
  onManualEdit: () => void;
  onDownload: () => void;
  originalImageUrl?: string;
  correctedImageUrl?: string;
  isProcessing?: boolean;
}

const CorrectorPanel: React.FC<CorrectorPanelProps> = ({
  report,
  onCorrectBackground,
  onCorrectSize,
  onCorrectCoverage,
  onCorrectAll,
  onManualEdit,
  onDownload,
  originalImageUrl,
  correctedImageUrl,
  isProcessing = false,
}) => {
  const { t } = useTranslation();

  const failedRules = report.rules.filter((rule) => rule.status === 'fail');
  const autoFixableRules = failedRules.filter((rule) => rule.autoFixable);
  const nonAutoFixableRules = failedRules.filter((rule) => !rule.autoFixable);

  const hasBackgroundFail = failedRules.some((r) => r.ruleId === 'background');
  const hasSizeFail = failedRules.some((r) => r.ruleId === 'size');
  const hasCoverageFail = failedRules.some((r) => r.ruleId === 'coverage');
  const hasAutoFixable = autoFixableRules.length > 0;
  const hasNonAutoFixable = nonAutoFixableRules.length > 0;

  return (
    <Card title={t('corrector.beforeAfter')} className="w-full">
      {/* Individual correction buttons */}
      <div className="mb-4">
        <Space wrap>
          {hasBackgroundFail && (
            <Button
              type="primary"
              icon={<BgColorsOutlined />}
              onClick={onCorrectBackground}
              disabled={isProcessing}
            >
              {t('corrector.replaceBackground')}
            </Button>
          )}

          {hasSizeFail && (
            <Button
              type="primary"
              icon={<ExpandOutlined />}
              onClick={onCorrectSize}
              disabled={isProcessing}
            >
              {t('corrector.resizeImage')}
            </Button>
          )}

          {hasCoverageFail && (
            <Button
              type="primary"
              icon={<CompressOutlined />}
              onClick={onCorrectCoverage}
              disabled={isProcessing}
            >
              {t('corrector.adjustCoverage')}
            </Button>
          )}
        </Space>
      </div>

      {/* Fix All button */}
      {hasAutoFixable && (
        <div className="mb-4">
          <Button
            type="primary"
            danger
            icon={isProcessing ? <LoadingOutlined /> : <ThunderboltOutlined />}
            onClick={onCorrectAll}
            disabled={isProcessing}
            loading={isProcessing}
          >
            {isProcessing ? t('corrector.processing') : t('corrector.fixAll')}
          </Button>
        </div>
      )}

      {/* Manual Edit button */}
      {hasNonAutoFixable && (
        <div className="mb-4">
          <Button
            icon={<EditOutlined />}
            onClick={onManualEdit}
            disabled={isProcessing}
          >
            {t('corrector.manualEdit')}
          </Button>
        </div>
      )}

      {/* Before/After comparison */}
      {correctedImageUrl && (
        <div className="mb-4">
          <Text strong className="block mb-2">
            {t('corrector.beforeAfter')}
          </Text>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Text type="secondary" className="block mb-1">
                {t('corrector.before')}
              </Text>
              {originalImageUrl && (
                <Image
                  src={originalImageUrl}
                  alt="Original"
                  className="w-full object-contain border rounded"
                  style={{ maxHeight: 300 }}
                />
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <Text type="secondary" className="block mb-1">
                {t('corrector.after')}
              </Text>
              <Image
                src={correctedImageUrl}
                alt="Corrected"
                className="w-full object-contain border rounded"
                style={{ maxHeight: 300 }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Download button */}
      {correctedImageUrl && (
        <div className="mt-4">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={onDownload}
          >
            {t('corrector.downloadCorrected')}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default CorrectorPanel;
