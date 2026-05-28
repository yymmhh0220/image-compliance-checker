import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportPanel from './ExportPanel';
import type { CorrectedImage } from '../../types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'export.title': 'Export Image',
        'export.format': 'Export Format',
        'export.quality': 'Image Quality',
        'export.fileName': 'File Name',
        'export.estimatedSize': 'Estimated File Size',
        'export.exportButton': 'Export',
        'export.batchExport': 'Batch Export',
        'export.success': 'Export successful',
        'common.download': 'Download',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the imageExporter module
vi.mock('../../core/exporter/imageExporter', () => ({
  estimateFileSize: vi.fn(() => 150000),
  generateDefaultFileName: vi.fn(
    (originalName: string, format: string) => {
      const baseName = originalName.replace(/\.[^.]+$/, '');
      return `${baseName}_compliant.${format}`;
    }
  ),
  exportImage: vi.fn(() => Promise.resolve(new Blob(['test'], { type: 'image/jpeg' }))),
  exportBatchAsZip: vi.fn(() => Promise.resolve(new Blob(['zip'], { type: 'application/zip' }))),
  downloadBlob: vi.fn(),
}));

function createMockImageData(width = 100, height = 100): ImageData {
  // jsdom doesn't provide ImageData, so create a compatible object
  const data = new Uint8ClampedArray(width * height * 4);
  return { data, width, height, colorSpace: 'srgb' } as unknown as ImageData;
}

function createMockCorrectedImage(id: string, fileName: string): CorrectedImage {
  return {
    imageId: id,
    originalFileName: fileName,
    imageData: createMockImageData(),
    width: 100,
    height: 100,
  };
}

describe('ExportPanel', () => {
  const mockOnExport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the export panel title', () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);
    expect(screen.getByText('Export Image')).toBeInTheDocument();
  });

  it('renders format radio group with JPEG, PNG, WebP options', () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);
    expect(screen.getByText('JPEG')).toBeInTheDocument();
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('WebP')).toBeInTheDocument();
  });

  it('renders quality slider for JPEG format (default)', () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);
    expect(screen.getByText(/Image Quality.*90/)).toBeInTheDocument();
  });

  it('renders file name input with default generated name', () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);
    const input = screen.getByDisplayValue('product_compliant.jpeg');
    expect(input).toBeInTheDocument();
  });

  it('renders estimated file size', () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);
    expect(screen.getByText(/Estimated File Size/)).toBeInTheDocument();
  });

  it('renders export button', () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('renders batch export button when multiple images', () => {
    const images = [
      createMockCorrectedImage('1', 'product1.jpg'),
      createMockCorrectedImage('2', 'product2.jpg'),
    ];
    render(<ExportPanel images={images} onExport={mockOnExport} />);
    expect(screen.getByRole('button', { name: 'Batch Export' })).toBeInTheDocument();
  });

  it('does not render batch export button for single image', () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);
    expect(screen.queryByRole('button', { name: 'Batch Export' })).not.toBeInTheDocument();
  });

  it('shows success message after export', async () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);

    const exportButton = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Export successful')).toBeInTheDocument();
    });
  });

  it('shows download again link after successful export', async () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);

    const exportButton = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  it('calls onExport callback after successful export', async () => {
    const images = [createMockCorrectedImage('1', 'product.jpg')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);

    const exportButton = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith({
        format: 'jpeg',
        quality: 90,
        fileName: 'product_compliant.jpeg',
        preserveResolution: true,
      });
    });
  });

  it('hides quality slider when PNG format is selected', () => {
    const images = [createMockCorrectedImage('1', 'product.png')];
    render(<ExportPanel images={images} onExport={mockOnExport} />);

    const pngRadio = screen.getByLabelText('PNG');
    fireEvent.click(pngRadio);

    expect(screen.queryByText(/Image Quality/)).not.toBeInTheDocument();
  });
});
