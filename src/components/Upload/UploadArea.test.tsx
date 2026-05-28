import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import UploadArea from './UploadArea';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'upload.dragText': 'Drag images here',
        'upload.clickText': 'or click to select files',
        'upload.supportedFormats': 'Supported formats: JPEG, PNG, WebP',
        'upload.title': 'Upload Images',
        'upload.formatError': 'Unsupported file format',
        'upload.sizeError': 'File size exceeds limit (max 20MB)',
        'upload.batchLimitError': 'Batch upload supports up to 20 images',
        'common.error': 'Error',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the imageStore
const mockAddImages = vi.fn();
vi.mock('../../store/imageStore', () => ({
  useImageStore: () => ({
    addImages: mockAddImages,
    images: [],
  }),
}));

describe('UploadArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the upload area with drag text', () => {
    render(<UploadArea />);
    expect(screen.getByText('Drag images here')).toBeInTheDocument();
  });

  it('renders the click-to-select text', () => {
    render(<UploadArea />);
    expect(screen.getByText('or click to select files')).toBeInTheDocument();
  });

  it('renders supported formats information', () => {
    render(<UploadArea />);
    expect(screen.getByText(/Supported formats: JPEG, PNG, WebP/)).toBeInTheDocument();
  });

  it('does not show thumbnail list when no images are uploaded', () => {
    render(<UploadArea />);
    expect(screen.queryByText(/Upload Images \(/)).not.toBeInTheDocument();
  });
});
