import type { TextResult, DetectedTextItem, BoundingBox } from '../../types';

// === URL Pattern Detection ===

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

/**
 * Detect if text contains URL patterns (http://, https://, www., domain formats)
 */
export function detectURLs(text: string): boolean {
  const regex = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  return regex.test(text);
}

/**
 * Extract all URL matches from text
 */
export function extractURLMatches(text: string): string[] {
  const regex = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  const matches = text.match(regex);
  return matches ?? [];
}

// === Price Pattern Detection ===

const PRICE_PATTERN = /[\$\u00A5\u20AC\u00A3\u20A9\u20B9]\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*[\$\u00A5\u20AC\u00A3\u20A9\u20B9]/g;

/**
 * Detect if text contains price patterns (currency symbols followed by digits)
 */
export function detectPrices(text: string): boolean {
  const regex = new RegExp(PRICE_PATTERN.source, PRICE_PATTERN.flags);
  return regex.test(text);
}

/**
 * Extract all price matches from text
 */
export function extractPriceMatches(text: string): string[] {
  const regex = new RegExp(PRICE_PATTERN.source, PRICE_PATTERN.flags);
  const matches = text.match(regex);
  return matches ?? [];
}

// === QR Code Detection (Heuristic) ===

/**
 * Basic QR code detection heuristic.
 * Looks for square-like high-contrast patterns in the image data
 * that could indicate a QR code (finder patterns - three corner squares).
 */
export function detectQRCode(imageData: ImageData): { detected: boolean; boundingBox: BoundingBox | null } {
  const { width, height, data } = imageData;

  // Convert to grayscale and threshold to binary
  const binaryGrid = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const gray = (r + g + b) / 3;
    binaryGrid[i] = gray < 128 ? 1 : 0;
  }

  // Look for finder pattern characteristics:
  // QR codes have three finder patterns (squares within squares) at corners.
  // We look for dense black square regions with specific aspect ratios.
  const blockSize = Math.max(8, Math.floor(Math.min(width, height) / 50));
  const gridW = Math.floor(width / blockSize);
  const gridH = Math.floor(height / blockSize);

  // Calculate density for each block
  const densityGrid = new Float32Array(gridW * gridH);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      let blackCount = 0;
      let totalCount = 0;
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const px = gx * blockSize + dx;
          const py = gy * blockSize + dy;
          if (px < width && py < height) {
            blackCount += binaryGrid[py * width + px];
            totalCount++;
          }
        }
      }
      densityGrid[gy * gridW + gx] = totalCount > 0 ? blackCount / totalCount : 0;
    }
  }

  // Look for clusters of high-density blocks forming a square pattern
  // A QR code typically occupies a square region with alternating black/white patterns
  let qrCandidateFound = false;
  let candidateBox: BoundingBox | null = null;

  // Search for 3+ consecutive high-density blocks in both directions
  const minQRBlocks = 3;
  for (let gy = 0; gy <= gridH - minQRBlocks && !qrCandidateFound; gy++) {
    for (let gx = 0; gx <= gridW - minQRBlocks && !qrCandidateFound; gx++) {
      let highDensityCount = 0;
      for (let dy = 0; dy < minQRBlocks; dy++) {
        for (let dx = 0; dx < minQRBlocks; dx++) {
          if (densityGrid[(gy + dy) * gridW + (gx + dx)] > 0.4) {
            highDensityCount++;
          }
        }
      }
      // If most blocks in the region are high-density, it might be a QR code
      if (highDensityCount >= minQRBlocks * minQRBlocks * 0.6) {
        // Verify it's roughly square and has alternating patterns nearby
        const regionDensity = highDensityCount / (minQRBlocks * minQRBlocks);
        if (regionDensity > 0.5 && regionDensity < 0.95) {
          qrCandidateFound = true;
          candidateBox = {
            x: gx * blockSize,
            y: gy * blockSize,
            width: minQRBlocks * blockSize,
            height: minQRBlocks * blockSize,
          };
        }
      }
    }
  }

  return { detected: qrCandidateFound, boundingBox: candidateBox };
}

// === Logo/Watermark Detection (Heuristic) ===

/**
 * Basic logo/watermark detection heuristic.
 * Detects semi-transparent overlays or repeated patterns that may indicate watermarks.
 * Also checks corners for logo-like elements.
 */
export function detectLogoWatermark(imageData: ImageData): { detected: boolean; boundingBox: BoundingBox | null } {
  const { width, height, data } = imageData;

  // Strategy 1: Check for semi-transparent or low-opacity patterns
  // Watermarks often have alpha < 255 or very light gray patterns
  const cornerSize = Math.floor(Math.min(width, height) * 0.15);

  // Check four corners for non-white, non-product content (potential logos)
  const corners = [
    { x: 0, y: 0 }, // top-left
    { x: width - cornerSize, y: 0 }, // top-right
    { x: 0, y: height - cornerSize }, // bottom-left
    { x: width - cornerSize, y: height - cornerSize }, // bottom-right
  ];

  for (const corner of corners) {
    let nonWhiteCount = 0;
    let totalPixels = 0;
    let hasAlphaVariation = false;

    for (let dy = 0; dy < cornerSize; dy++) {
      for (let dx = 0; dx < cornerSize; dx++) {
        const px = corner.x + dx;
        const py = corner.y + dy;
        if (px >= width || py >= height) continue;

        const idx = (py * width + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        totalPixels++;

        // Check for semi-transparent pixels (watermark indicator)
        if (a < 250 && a > 10) {
          hasAlphaVariation = true;
        }

        // Check for light gray patterns (typical watermark colors)
        if (r < 240 || g < 240 || b < 240) {
          if (r > 180 && g > 180 && b > 180) {
            // Light gray - potential watermark
            nonWhiteCount++;
          }
        }
      }
    }

    const nonWhiteRatio = totalPixels > 0 ? nonWhiteCount / totalPixels : 0;

    // If corner has semi-transparent content or significant light gray patterns
    if (hasAlphaVariation || (nonWhiteRatio > 0.1 && nonWhiteRatio < 0.6)) {
      return {
        detected: true,
        boundingBox: {
          x: corner.x,
          y: corner.y,
          width: cornerSize,
          height: cornerSize,
        },
      };
    }
  }

  // Strategy 2: Check for repeated patterns across the image (tiled watermarks)
  // Sample horizontal strips and check for periodic patterns
  const numStrips = 5;
  const stripSpacing = Math.floor(height / (numStrips + 1));

  let periodicPatternCount = 0;
  for (let s = 1; s <= numStrips; s++) {
    const y = s * stripSpacing;
    if (y >= height) continue;

    // Sample pixels along the strip
    const samples: number[] = [];
    const sampleStep = Math.max(1, Math.floor(width / 100));
    for (let x = 0; x < width; x += sampleStep) {
      const idx = (y * width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      samples.push(gray);
    }

    // Check for periodic dips (watermark text repeating)
    let dips = 0;
    for (let i = 1; i < samples.length - 1; i++) {
      if (samples[i] < samples[i - 1] - 20 && samples[i] < samples[i + 1] - 20) {
        dips++;
      }
    }

    if (dips >= 3) {
      periodicPatternCount++;
    }
  }

  if (periodicPatternCount >= 3) {
    return {
      detected: true,
      boundingBox: {
        x: 0,
        y: 0,
        width,
        height,
      },
    };
  }

  return { detected: false, boundingBox: null };
}

// === OCR with Tesseract.js ===

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Perform OCR on image data using Tesseract.js with a 30-second timeout.
 * Returns recognized words with their bounding boxes.
 */
async function performOCR(imageData: ImageData): Promise<TesseractWord[]> {
  const { createWorker } = await import('tesseract.js');

  // Convert ImageData to canvas and then to blob for Tesseract
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/png');
  });

  const worker = await createWorker('eng+chi_sim+jpn');

  // Use Promise.race for 30-second timeout
  const ocrPromise = worker.recognize(blob).then((result) => {
    const words: TesseractWord[] = [];
    for (const block of result.data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          for (const word of line.words ?? []) {
            if (word.text.trim().length > 0) {
              words.push({
                text: word.text.trim(),
                confidence: word.confidence / 100,
                bbox: word.bbox,
              });
            }
          }
        }
      }
    }
    return words;
  });

  const timeoutPromise = new Promise<TesseractWord[]>((_, reject) => {
    setTimeout(() => reject(new Error('OCR timeout: exceeded 30 seconds')), 30000);
  });

  try {
    const words = await Promise.race([ocrPromise, timeoutPromise]);
    await worker.terminate();
    return words;
  } catch (error) {
    await worker.terminate().catch(() => {});
    if (error instanceof Error && error.message.includes('timeout')) {
      console.warn('OCR timed out after 30 seconds');
      return [];
    }
    throw error;
  }
}

// === Main Analysis Function ===

/**
 * Analyze image for text, URLs, prices, QR codes, and logos/watermarks.
 * Uses Tesseract.js for OCR with a 30-second timeout.
 */
export async function analyzeText(imageData: ImageData): Promise<TextResult> {
  const detectedItems: DetectedTextItem[] = [];

  // 1. Perform OCR
  let ocrWords: TesseractWord[] = [];
  try {
    ocrWords = await performOCR(imageData);
  } catch (error) {
    console.warn('OCR failed:', error);
  }

  // 2. Analyze OCR results for URLs and prices
  const fullText = ocrWords.map((w) => w.text).join(' ');
  const hasURL = detectURLs(fullText);
  const hasPrice = detectPrices(fullText);
  const hasText = ocrWords.length > 0;

  // Add URL violations
  if (hasURL) {
    const urlMatches = extractURLMatches(fullText);
    for (const url of urlMatches) {
      // Find the word(s) that contain this URL
      const matchingWord = ocrWords.find((w) => url.includes(w.text) || w.text.includes(url));
      const bbox: BoundingBox = matchingWord
        ? {
            x: matchingWord.bbox.x0,
            y: matchingWord.bbox.y0,
            width: matchingWord.bbox.x1 - matchingWord.bbox.x0,
            height: matchingWord.bbox.y1 - matchingWord.bbox.y0,
          }
        : { x: 0, y: 0, width: imageData.width, height: imageData.height };

      detectedItems.push({
        text: url,
        type: 'url',
        confidence: matchingWord?.confidence ?? 0.5,
        boundingBox: bbox,
      });
    }
  }

  // Add price violations
  if (hasPrice) {
    const priceMatches = extractPriceMatches(fullText);
    for (const price of priceMatches) {
      const matchingWord = ocrWords.find((w) => price.includes(w.text) || w.text.includes(price));
      const bbox: BoundingBox = matchingWord
        ? {
            x: matchingWord.bbox.x0,
            y: matchingWord.bbox.y0,
            width: matchingWord.bbox.x1 - matchingWord.bbox.x0,
            height: matchingWord.bbox.y1 - matchingWord.bbox.y0,
          }
        : { x: 0, y: 0, width: imageData.width, height: imageData.height };

      detectedItems.push({
        text: price,
        type: 'price',
        confidence: matchingWord?.confidence ?? 0.5,
        boundingBox: bbox,
      });
    }
  }

  // 3. QR Code detection
  const qrResult = detectQRCode(imageData);
  const hasQRCode = qrResult.detected;
  if (hasQRCode && qrResult.boundingBox) {
    detectedItems.push({
      text: 'QR Code',
      type: 'qrcode',
      confidence: 0.6,
      boundingBox: qrResult.boundingBox,
    });
  }

  // 4. Logo/Watermark detection
  const logoResult = detectLogoWatermark(imageData);
  const hasLogo = logoResult.detected;
  if (hasLogo && logoResult.boundingBox) {
    detectedItems.push({
      text: 'Logo/Watermark',
      type: 'logo',
      confidence: 0.5,
      boundingBox: logoResult.boundingBox,
    });
  }

  // 5. Determine compliance - non-compliant if any violation detected
  const isCompliant = !hasText && !hasURL && !hasPrice && !hasQRCode && !hasLogo;

  return {
    hasText,
    hasURL,
    hasPrice,
    hasQRCode,
    hasLogo,
    detectedItems,
    isCompliant,
  };
}
