import React from 'react';
import { Card, Tag, List, Button, Space, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ToolOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ComplianceReportProps, ComplianceRuleResult } from '../../types';

const { Text } = Typography;

const ComplianceReport: React.FC<ComplianceReportProps> = ({
  report,
  onCorrectItem,
  onCorrectAll,
  onManualEdit,
}) => {
  const { t } = useTranslation();

  const isCompliant = report.overallStatus === 'compliant';
  const failedAutoFixableRules = report.rules.filter(
    (rule) => rule.status === 'fail' && rule.autoFixable
  );
  const hasAutoFixableFailures = failedAutoFixableRules.length > 0;

  const renderRuleItem = (rule: ComplianceRuleResult) => {
    const isPassed = rule.status === 'pass';

    return (
      <List.Item>
        <div className="w-full">
          <div className="flex items-center justify-between">
            <Space>
              {isPassed ? (
                <CheckCircleOutlined className="text-green-500 text-lg" />
              ) : (
                <CloseCircleOutlined className="text-red-500 text-lg" />
              )}
              <Text strong>{rule.ruleName}</Text>
            </Space>

            {!isPassed && (
              <Space>
                {rule.autoFixable ? (
                  <Button
                    type="primary"
                    size="small"
                    icon={<ToolOutlined />}
                    onClick={() => onCorrectItem(rule.ruleId)}
                  >
                    {t('report.autoFix')}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={onManualEdit}
                  >
                    {t('report.manualEdit')}
                  </Button>
                )}
              </Space>
            )}
          </div>

          <div className="ml-7 mt-1">
            <Text type="secondary">{rule.details}</Text>
          </div>

          {!isPassed && rule.suggestion && (
            <div className="ml-7 mt-1">
              <Text type="warning">
                {t('report.suggestion')}: {rule.suggestion}
              </Text>
            </div>
          )}
        </div>
      </List.Item>
    );
  };

  return (
    <Card
      title={t('report.title')}
      className="w-full"
      extra={
        <Tag color={isCompliant ? 'green' : 'red'}>
          {isCompliant ? t('report.compliant') : t('report.nonCompliant')}
        </Tag>
      }
    >
      <List
        dataSource={report.rules}
        renderItem={renderRuleItem}
        split
      />

      {hasAutoFixableFailures && (
        <div className="mt-4 flex justify-end">
          <Button
            type="primary"
            icon={<ToolOutlined />}
            onClick={onCorrectAll}
          >
            {t('report.fixAll')}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default ComplianceReport;
