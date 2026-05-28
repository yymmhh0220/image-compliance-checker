import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ComplianceReport from './ComplianceReport';
import type { ComplianceReport as ComplianceReportType } from '../../types';

// Mock window.matchMedia for Ant Design responsive components
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'report.title': 'Compliance Report',
        'report.compliant': 'Compliant',
        'report.nonCompliant': 'Non-compliant',
        'report.suggestion': 'Suggestion',
        'report.autoFix': 'Auto Fix',
        'report.manualEdit': 'Manual Edit',
        'report.fixAll': 'Fix All',
      };
      return translations[key] || key;
    },
  }),
}));

const createMockReport = (
  overallStatus: 'compliant' | 'non-compliant',
  rules: ComplianceReportType['rules'] = []
): ComplianceReportType => ({
  imageId: 'test-image-1',
  overallStatus,
  timestamp: Date.now(),
  rules,
});

describe('ComplianceReport', () => {
  const defaultProps = {
    onCorrectItem: vi.fn(),
    onCorrectAll: vi.fn(),
    onManualEdit: vi.fn(),
  };

  it('renders the report title', () => {
    const report = createMockReport('compliant', []);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.getByText('Compliance Report')).toBeInTheDocument();
  });

  it('displays green "Compliant" tag when overall status is compliant', () => {
    const report = createMockReport('compliant', [
      {
        ruleId: 'size',
        ruleName: 'Image Size',
        status: 'pass',
        details: 'Long edge is 1200px',
        autoFixable: true,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.getByText('Compliant')).toBeInTheDocument();
  });

  it('displays red "Non-compliant" tag when overall status is non-compliant', () => {
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'size',
        ruleName: 'Image Size',
        status: 'fail',
        details: 'Long edge is 800px',
        suggestion: 'Resize to at least 1000px',
        autoFixable: true,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.getByText('Non-compliant')).toBeInTheDocument();
  });

  it('renders each rule with its name and details', () => {
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'size',
        ruleName: 'Image Size',
        status: 'pass',
        details: 'Long edge is 1200px',
        autoFixable: true,
      },
      {
        ruleId: 'background',
        ruleName: 'Background Color',
        status: 'fail',
        details: 'Background is not pure white',
        suggestion: 'Replace background with white',
        autoFixable: true,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.getByText('Image Size')).toBeInTheDocument();
    expect(screen.getByText('Long edge is 1200px')).toBeInTheDocument();
    expect(screen.getByText('Background Color')).toBeInTheDocument();
    expect(screen.getByText('Background is not pure white')).toBeInTheDocument();
  });

  it('shows suggestion text for failed rules', () => {
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'background',
        ruleName: 'Background Color',
        status: 'fail',
        details: 'Background is not pure white',
        suggestion: 'Replace background with white',
        autoFixable: true,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.getByText(/Replace background with white/)).toBeInTheDocument();
  });

  it('shows "Auto Fix" button for autoFixable failed rules', () => {
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'size',
        ruleName: 'Image Size',
        status: 'fail',
        details: 'Long edge is 800px',
        suggestion: 'Resize to 1000px',
        autoFixable: true,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.getByText('Auto Fix')).toBeInTheDocument();
  });

  it('shows "Manual Edit" button for non-autoFixable failed rules', () => {
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'text',
        ruleName: 'Text and Marks',
        status: 'fail',
        details: 'Text detected in image',
        suggestion: 'Remove text manually',
        autoFixable: false,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.getByText('Manual Edit')).toBeInTheDocument();
  });

  it('calls onCorrectItem when "Auto Fix" button is clicked', () => {
    const onCorrectItem = vi.fn();
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'background',
        ruleName: 'Background Color',
        status: 'fail',
        details: 'Background is not pure white',
        suggestion: 'Replace background',
        autoFixable: true,
      },
    ]);
    render(
      <ComplianceReport
        report={report}
        onCorrectItem={onCorrectItem}
        onCorrectAll={vi.fn()}
        onManualEdit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Auto Fix'));
    expect(onCorrectItem).toHaveBeenCalledWith('background');
  });

  it('calls onManualEdit when "Manual Edit" button is clicked', () => {
    const onManualEdit = vi.fn();
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'text',
        ruleName: 'Text and Marks',
        status: 'fail',
        details: 'Text detected',
        suggestion: 'Remove text',
        autoFixable: false,
      },
    ]);
    render(
      <ComplianceReport
        report={report}
        onCorrectItem={vi.fn()}
        onCorrectAll={vi.fn()}
        onManualEdit={onManualEdit}
      />
    );
    fireEvent.click(screen.getByText('Manual Edit'));
    expect(onManualEdit).toHaveBeenCalled();
  });

  it('shows "Fix All" button when there are autoFixable failures', () => {
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'size',
        ruleName: 'Image Size',
        status: 'fail',
        details: 'Too small',
        suggestion: 'Resize',
        autoFixable: true,
      },
      {
        ruleId: 'background',
        ruleName: 'Background',
        status: 'fail',
        details: 'Not white',
        suggestion: 'Replace',
        autoFixable: true,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.getByText('Fix All')).toBeInTheDocument();
  });

  it('does not show "Fix All" button when all rules pass', () => {
    const report = createMockReport('compliant', [
      {
        ruleId: 'size',
        ruleName: 'Image Size',
        status: 'pass',
        details: 'OK',
        autoFixable: true,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.queryByText('Fix All')).not.toBeInTheDocument();
  });

  it('calls onCorrectAll when "Fix All" button is clicked', () => {
    const onCorrectAll = vi.fn();
    const report = createMockReport('non-compliant', [
      {
        ruleId: 'size',
        ruleName: 'Image Size',
        status: 'fail',
        details: 'Too small',
        suggestion: 'Resize',
        autoFixable: true,
      },
    ]);
    render(
      <ComplianceReport
        report={report}
        onCorrectItem={vi.fn()}
        onCorrectAll={onCorrectAll}
        onManualEdit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Fix All'));
    expect(onCorrectAll).toHaveBeenCalled();
  });

  it('does not show action buttons for passing rules', () => {
    const report = createMockReport('compliant', [
      {
        ruleId: 'size',
        ruleName: 'Image Size',
        status: 'pass',
        details: 'Long edge is 1200px',
        autoFixable: true,
      },
    ]);
    render(<ComplianceReport report={report} {...defaultProps} />);
    expect(screen.queryByText('Auto Fix')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual Edit')).not.toBeInTheDocument();
  });
});
