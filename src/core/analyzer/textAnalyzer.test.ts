import { describe, it, expect } from 'vitest';
import {
  detectURLs,
  detectPrices,
  extractURLMatches,
  extractPriceMatches,
} from './textAnalyzer';

describe('textAnalyzer - URL Pattern Detection', () => {
  it('should detect http:// URLs', () => {
    expect(detectURLs('Visit http://example.com for more')).toBe(true);
  });

  it('should detect https:// URLs', () => {
    expect(detectURLs('Go to https://www.shop.com/product')).toBe(true);
  });

  it('should detect www. URLs', () => {
    expect(detectURLs('Check www.amazon.com')).toBe(true);
  });

  it('should detect domain format URLs', () => {
    expect(detectURLs('Visit example.com today')).toBe(true);
  });

  it('should detect URLs with paths', () => {
    expect(detectURLs('https://shop.co.jp/items/123')).toBe(true);
  });

  it('should not detect plain text without URLs', () => {
    expect(detectURLs('This is just plain text')).toBe(false);
  });

  it('should not detect single words', () => {
    expect(detectURLs('hello world')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(detectURLs('')).toBe(false);
  });

  it('should detect multiple URLs', () => {
    const text = 'Visit http://a.com and https://b.org';
    expect(detectURLs(text)).toBe(true);
  });
});

describe('textAnalyzer - extractURLMatches', () => {
  it('should extract http URLs', () => {
    const matches = extractURLMatches('Go to http://example.com now');
    expect(matches).toContain('http://example.com');
  });

  it('should extract https URLs', () => {
    const matches = extractURLMatches('Visit https://shop.com/page');
    expect(matches).toContain('https://shop.com/page');
  });

  it('should extract www URLs', () => {
    const matches = extractURLMatches('See www.test.org for details');
    expect(matches).toContain('www.test.org');
  });

  it('should extract domain format URLs', () => {
    const matches = extractURLMatches('Check amazon.co.jp today');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('should return empty array for no matches', () => {
    const matches = extractURLMatches('No URLs here');
    expect(matches).toEqual([]);
  });

  it('should extract multiple URLs', () => {
    const matches = extractURLMatches('http://a.com and www.b.org');
    expect(matches.length).toBe(2);
  });

  it('should return empty array for empty string', () => {
    expect(extractURLMatches('')).toEqual([]);
  });
});

describe('textAnalyzer - Price Pattern Detection', () => {
  it('should detect dollar prices', () => {
    expect(detectPrices('Only $19.99')).toBe(true);
  });

  it('should detect yen prices', () => {
    expect(detectPrices('価格 ¥1980')).toBe(true);
  });

  it('should detect euro prices', () => {
    expect(detectPrices('Price: €29.50')).toBe(true);
  });

  it('should detect pound prices', () => {
    expect(detectPrices('Was £15.00')).toBe(true);
  });

  it('should detect won prices', () => {
    expect(detectPrices('₩25000')).toBe(true);
  });

  it('should detect rupee prices', () => {
    expect(detectPrices('₹999')).toBe(true);
  });

  it('should detect prices with comma separators', () => {
    expect(detectPrices('$1,299')).toBe(true);
  });

  it('should detect currency symbol after number', () => {
    expect(detectPrices('1980¥')).toBe(true);
  });

  it('should not detect plain text without prices', () => {
    expect(detectPrices('This is just text')).toBe(false);
  });

  it('should not detect standalone currency symbols', () => {
    expect(detectPrices('The $ sign')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(detectPrices('')).toBe(false);
  });

  it('should not detect numbers without currency symbols', () => {
    expect(detectPrices('Item 12345')).toBe(false);
  });
});

describe('textAnalyzer - extractPriceMatches', () => {
  it('should extract dollar prices', () => {
    const matches = extractPriceMatches('Buy for $9.99 today');
    expect(matches).toContain('$9.99');
  });

  it('should extract yen prices', () => {
    const matches = extractPriceMatches('¥2000 only');
    expect(matches).toContain('¥2000');
  });

  it('should extract euro prices', () => {
    const matches = extractPriceMatches('€15.50 discount');
    expect(matches).toContain('€15.50');
  });

  it('should extract multiple prices', () => {
    const matches = extractPriceMatches('Was $29.99, now $19.99');
    expect(matches.length).toBe(2);
  });

  it('should return empty array for no prices', () => {
    expect(extractPriceMatches('No prices here')).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(extractPriceMatches('')).toEqual([]);
  });

  it('should extract prices with space between symbol and number', () => {
    const matches = extractPriceMatches('$ 50');
    expect(matches.length).toBe(1);
  });
});
