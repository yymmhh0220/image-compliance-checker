import { describe, it, expect } from 'vitest';
import { calculateNewDimensions } from './sizeCorrector';

describe('calculateNewDimensions', () => {
  it('should return original dimensions when longest edge already >= target', () => {
    const result = calculateNewDimensions(1200, 800, 1000);
    expect(result.newWidth).toBe(1200);
    expect(result.newHeight).toBe(800);
  });

  it('should return original dimensions when longest edge equals target exactly', () => {
    const result = calculateNewDimensions(1000, 600, 1000);
    expect(result.newWidth).toBe(1000);
    expect(result.newHeight).toBe(600);
  });

  it('should scale up landscape image so longest edge equals target', () => {
    // 800x600 landscape image, target 1000
    const result = calculateNewDimensions(800, 600, 1000);
    // scale = 1000 / 800 = 1.25
    // newWidth = round(800 * 1.25) = 1000
    // newHeight = round(600 * 1.25) = 750
    expect(result.newWidth).toBe(1000);
    expect(result.newHeight).toBe(750);
    // Verify longest edge is target
    expect(Math.max(result.newWidth, result.newHeight)).toBe(1000);
  });

  it('should scale up portrait image so longest edge equals target', () => {
    // 600x800 portrait image, target 1000
    const result = calculateNewDimensions(600, 800, 1000);
    // scale = 1000 / 800 = 1.25
    // newWidth = round(600 * 1.25) = 750
    // newHeight = round(800 * 1.25) = 1000
    expect(result.newWidth).toBe(750);
    expect(result.newHeight).toBe(1000);
    // Verify longest edge is target
    expect(Math.max(result.newWidth, result.newHeight)).toBe(1000);
  });

  it('should scale up square image so both edges equal target', () => {
    const result = calculateNewDimensions(500, 500, 1000);
    // scale = 1000 / 500 = 2
    expect(result.newWidth).toBe(1000);
    expect(result.newHeight).toBe(1000);
  });

  it('should preserve aspect ratio for landscape images (error < 0.01)', () => {
    const width = 640;
    const height = 480;
    const originalRatio = width / height;
    const result = calculateNewDimensions(width, height, 1000);
    const newRatio = result.newWidth / result.newHeight;
    expect(Math.abs(originalRatio - newRatio)).toBeLessThan(0.01);
  });

  it('should preserve aspect ratio for portrait images (error < 0.01)', () => {
    const width = 480;
    const height = 640;
    const originalRatio = width / height;
    const result = calculateNewDimensions(width, height, 1000);
    const newRatio = result.newWidth / result.newHeight;
    expect(Math.abs(originalRatio - newRatio)).toBeLessThan(0.01);
  });

  it('should preserve aspect ratio for extreme aspect ratios (error < 0.01)', () => {
    // Very wide image
    const width = 900;
    const height = 100;
    const originalRatio = width / height;
    const result = calculateNewDimensions(width, height, 1000);
    const newRatio = result.newWidth / result.newHeight;
    expect(Math.abs(originalRatio - newRatio)).toBeLessThan(0.01);
    expect(Math.max(result.newWidth, result.newHeight)).toBe(1000);
  });

  it('should preserve aspect ratio for very tall images (error < 0.01)', () => {
    // Very tall image
    const width = 100;
    const height = 900;
    const originalRatio = width / height;
    const result = calculateNewDimensions(width, height, 1000);
    const newRatio = result.newWidth / result.newHeight;
    expect(Math.abs(originalRatio - newRatio)).toBeLessThan(0.01);
    expect(Math.max(result.newWidth, result.newHeight)).toBe(1000);
  });

  it('should handle small images correctly', () => {
    const result = calculateNewDimensions(50, 30, 1000);
    // scale = 1000 / 50 = 20
    expect(result.newWidth).toBe(1000);
    expect(result.newHeight).toBe(600);
    expect(Math.max(result.newWidth, result.newHeight)).toBe(1000);
  });

  it('should handle custom target long edge values', () => {
    const result = calculateNewDimensions(400, 300, 2000);
    // scale = 2000 / 400 = 5
    expect(result.newWidth).toBe(2000);
    expect(result.newHeight).toBe(1500);
    expect(Math.max(result.newWidth, result.newHeight)).toBe(2000);
  });

  it('should return original dimensions when image is larger than target', () => {
    const result = calculateNewDimensions(2000, 1500, 1000);
    expect(result.newWidth).toBe(2000);
    expect(result.newHeight).toBe(1500);
  });
});
