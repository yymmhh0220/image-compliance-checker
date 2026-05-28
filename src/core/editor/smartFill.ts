import type { Point, Region } from '../../types';

/**
 * Creates an ImageData-compatible object. Works in both browser and test environments.
 */
function createImageDataCopy(source: ImageData): ImageData {
  return {
    width: source.width,
    height: source.height,
    data: new Uint8ClampedArray(source.data),
    colorSpace: source.colorSpace ?? 'srgb',
  } as ImageData;
}

/**
 * Determines if a point is inside a polygon defined by region.points
 * using the ray-casting algorithm.
 *
 * @param point - The point to test
 * @param region - The region defined by an array of polygon vertices
 * @returns true if the point is inside the polygon
 */
export function isPointInRegion(point: Point, region: Region): boolean {
  const { points } = region;
  if (points.length < 3) {
    return false;
  }

  let inside = false;
  const n = points.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Applies smart fill to a region by sampling surrounding pixels and interpolating
 * to create a natural transition effect.
 *
 * Algorithm:
 * 1. Find the bounding box of the region
 * 2. For each pixel inside the region, sample the nearest pixels OUTSIDE the region boundary
 * 3. Use distance-weighted average of surrounding pixels to fill
 * 4. Apply Gaussian-like blending at the edges for natural transition
 *
 * @param imageData - The current image data
 * @param region - The region to fill (defined by boundary points)
 * @returns An object containing the new image data and previous data for undo
 */
export function applySmartFill(
  imageData: ImageData,
  region: Region
): { newImageData: ImageData; previousData: ImageData } {
  // Save a copy of the original data for undo
  const previousData = createImageDataCopy(imageData);

  // Create a new ImageData with a copy of the pixel data
  const newImageData = createImageDataCopy(imageData);

  const { points } = region;
  if (points.length < 3) {
    return { newImageData, previousData };
  }

  // Find bounding box of the region
  const boundingBox = getBoundingBox(points, imageData.width, imageData.height);

  // Collect boundary sample points (pixels just outside the region)
  const boundarySamples = collectBoundarySamples(
    imageData,
    region,
    boundingBox
  );

  // If no boundary samples found, fill with white as fallback
  if (boundarySamples.length === 0) {
    fillRegionWithColor(newImageData, region, boundingBox, 255, 255, 255, 255);
    return { newImageData, previousData };
  }

  // Compute the maximum distance from any interior pixel to the boundary
  // for edge blending normalization
  const edgeWidth = computeEdgeWidth(region, boundingBox);

  // For each pixel inside the region, compute distance-weighted fill
  for (let y = boundingBox.minY; y <= boundingBox.maxY; y++) {
    for (let x = boundingBox.minX; x <= boundingBox.maxX; x++) {
      if (!isPointInRegion({ x, y }, region)) {
        continue;
      }

      const index = (y * imageData.width + x) * 4;

      // Compute distance-weighted average from boundary samples
      const filled = computeWeightedFill(x, y, boundarySamples);

      // Compute edge blend factor (Gaussian-like falloff near edges)
      const edgeFactor = computeEdgeBlendFactor(x, y, region, edgeWidth);

      // Blend between original pixel and filled pixel based on edge factor
      // edgeFactor = 1.0 at center (full fill), 0.0 at edge (original pixel)
      const originalR = imageData.data[index];
      const originalG = imageData.data[index + 1];
      const originalB = imageData.data[index + 2];
      const originalA = imageData.data[index + 3];

      newImageData.data[index] = Math.round(
        originalR * (1 - edgeFactor) + filled.r * edgeFactor
      );
      newImageData.data[index + 1] = Math.round(
        originalG * (1 - edgeFactor) + filled.g * edgeFactor
      );
      newImageData.data[index + 2] = Math.round(
        originalB * (1 - edgeFactor) + filled.b * edgeFactor
      );
      newImageData.data[index + 3] = Math.round(
        originalA * (1 - edgeFactor) + filled.a * edgeFactor
      );
    }
  }

  return { newImageData, previousData };
}

// === Helper types and functions ===

interface BoundingBoxRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ColorSample {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Computes the bounding box of a set of points, clamped to image dimensions.
 */
function getBoundingBox(
  points: Point[],
  width: number,
  height: number
): BoundingBoxRect {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX: Math.max(0, Math.floor(minX)),
    maxX: Math.min(width - 1, Math.ceil(maxX)),
    minY: Math.max(0, Math.floor(minY)),
    maxY: Math.min(height - 1, Math.ceil(maxY)),
  };
}

/**
 * Collects pixel samples from just outside the region boundary.
 * Samples pixels that are within a small margin outside the region.
 */
function collectBoundarySamples(
  imageData: ImageData,
  region: Region,
  boundingBox: BoundingBoxRect
): ColorSample[] {
  const samples: ColorSample[] = [];
  const margin = 2; // Sample pixels within 2px outside the region

  const expandedBox = {
    minX: Math.max(0, boundingBox.minX - margin),
    maxX: Math.min(imageData.width - 1, boundingBox.maxX + margin),
    minY: Math.max(0, boundingBox.minY - margin),
    maxY: Math.min(imageData.height - 1, boundingBox.maxY + margin),
  };

  for (let y = expandedBox.minY; y <= expandedBox.maxY; y++) {
    for (let x = expandedBox.minX; x <= expandedBox.maxX; x++) {
      // Only collect pixels that are OUTSIDE the region
      if (isPointInRegion({ x, y }, region)) {
        continue;
      }

      // Check if this pixel is near the region boundary
      const distToRegion = minDistanceToPolygon({ x, y }, region.points);
      if (distToRegion <= margin) {
        const index = (y * imageData.width + x) * 4;
        samples.push({
          x,
          y,
          r: imageData.data[index],
          g: imageData.data[index + 1],
          b: imageData.data[index + 2],
          a: imageData.data[index + 3],
        });
      }
    }
  }

  return samples;
}

/**
 * Computes the minimum distance from a point to a polygon edge.
 */
function minDistanceToPolygon(point: Point, polygonPoints: Point[]): number {
  let minDist = Infinity;
  const n = polygonPoints.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dist = distanceToSegment(point, polygonPoints[i], polygonPoints[j]);
    if (dist < minDist) {
      minDist = dist;
    }
  }

  return minDist;
}

/**
 * Computes the distance from a point to a line segment.
 */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Segment is a point
    return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Computes the distance-weighted average color from boundary samples.
 * Uses inverse distance weighting (IDW) with power 2.
 */
function computeWeightedFill(
  x: number,
  y: number,
  samples: ColorSample[]
): { r: number; g: number; b: number; a: number } {
  let totalWeight = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;

  for (const sample of samples) {
    const dx = x - sample.x;
    const dy = y - sample.y;
    const distSq = dx * dx + dy * dy;

    if (distSq === 0) {
      // Exact match - use this sample directly
      return { r: sample.r, g: sample.g, b: sample.b, a: sample.a };
    }

    // Inverse distance weighting with power 2
    const weight = 1 / distSq;
    totalWeight += weight;
    r += sample.r * weight;
    g += sample.g * weight;
    b += sample.b * weight;
    a += sample.a * weight;
  }

  if (totalWeight === 0) {
    return { r: 255, g: 255, b: 255, a: 255 };
  }

  return {
    r: Math.round(r / totalWeight),
    g: Math.round(g / totalWeight),
    b: Math.round(b / totalWeight),
    a: Math.round(a / totalWeight),
  };
}

/**
 * Computes the edge width for blending normalization.
 * Returns a reasonable edge width based on the region size.
 */
function computeEdgeWidth(_region: Region, boundingBox: BoundingBoxRect): number {
  const width = boundingBox.maxX - boundingBox.minX;
  const height = boundingBox.maxY - boundingBox.minY;
  const minDimension = Math.min(width, height);

  // Edge transition zone is ~20% of the smallest dimension, minimum 2px
  return Math.max(2, minDimension * 0.2);
}

/**
 * Computes the edge blend factor using a Gaussian-like falloff.
 * Returns 1.0 at the center of the region (full fill) and
 * approaches 0.0 near the edges (preserving original pixels for smooth transition).
 */
function computeEdgeBlendFactor(
  x: number,
  y: number,
  region: Region,
  edgeWidth: number
): number {
  // Distance from this pixel to the nearest polygon edge
  const distToEdge = minDistanceToPolygon({ x, y }, region.points);

  if (distToEdge >= edgeWidth) {
    return 1.0; // Fully inside - use fill color
  }

  // Gaussian-like smooth transition: smoothstep function
  const t = distToEdge / edgeWidth;
  // Smoothstep: 3t² - 2t³
  return t * t * (3 - 2 * t);
}

/**
 * Fills all pixels inside the region with a solid color (fallback).
 */
function fillRegionWithColor(
  imageData: ImageData,
  region: Region,
  boundingBox: BoundingBoxRect,
  r: number,
  g: number,
  b: number,
  a: number
): void {
  for (let y = boundingBox.minY; y <= boundingBox.maxY; y++) {
    for (let x = boundingBox.minX; x <= boundingBox.maxX; x++) {
      if (isPointInRegion({ x, y }, region)) {
        const index = (y * imageData.width + x) * 4;
        imageData.data[index] = r;
        imageData.data[index + 1] = g;
        imageData.data[index + 2] = b;
        imageData.data[index + 3] = a;
      }
    }
  }
}
