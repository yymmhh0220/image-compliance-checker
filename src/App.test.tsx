import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Import i18n to initialize translations in test environment
import './i18n';

describe('App', () => {
  it('renders the application title', () => {
    render(<App />);
    // The title comes from i18n common.appTitle (zh default: 图片合规检测工具)
    expect(screen.getByText('图片合规检测工具')).toBeInTheDocument();
  });

  it('renders the upload area in idle state', () => {
    render(<App />);
    // Upload area should be visible in idle state (zh: 拖拽图片到此处)
    expect(screen.getByText('拖拽图片到此处')).toBeInTheDocument();
  });
});
