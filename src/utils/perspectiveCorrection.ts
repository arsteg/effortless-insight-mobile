/**
 * Perspective Correction Utility
 *
 * Provides functions for auto-cropping and perspective transformation
 * of scanned document images to produce clean, properly aligned output.
 */

import * as ImageManipulator from 'expo-image-manipulator';

interface Point {
  x: number;
  y: number;
}

interface DetectedEdges {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
  confidence: number;
}

interface CropRegion {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

interface PerspectiveCorrectionResult {
  uri: string;
  width: number;
  height: number;
  wasTransformed: boolean;
}

/**
 * Calculate the bounding box from detected edges
 */
function calculateBoundingBox(edges: DetectedEdges, imageWidth: number, imageHeight: number): CropRegion {
  const minX = Math.min(edges.topLeft.x, edges.bottomLeft.x) * imageWidth;
  const maxX = Math.max(edges.topRight.x, edges.bottomRight.x) * imageWidth;
  const minY = Math.min(edges.topLeft.y, edges.topRight.y) * imageHeight;
  const maxY = Math.max(edges.bottomLeft.y, edges.bottomRight.y) * imageHeight;

  // Add small padding
  const padding = 10;

  return {
    originX: Math.max(0, minX - padding),
    originY: Math.max(0, minY - padding),
    width: Math.min(imageWidth, maxX - minX + padding * 2),
    height: Math.min(imageHeight, maxY - minY + padding * 2),
  };
}

/**
 * Calculate rotation angle from detected edges
 */
function calculateRotationAngle(edges: DetectedEdges): number {
  // Calculate the angle of the top edge
  const dx = edges.topRight.x - edges.topLeft.x;
  const dy = edges.topRight.y - edges.topLeft.y;
  const angleRadians = Math.atan2(dy, dx);
  const angleDegrees = (angleRadians * 180) / Math.PI;

  // Only correct if the angle is significant but not too extreme
  if (Math.abs(angleDegrees) > 1 && Math.abs(angleDegrees) < 15) {
    return -angleDegrees;
  }

  return 0;
}

/**
 * Calculate aspect ratio correction
 */
function calculateAspectCorrection(edges: DetectedEdges): { scaleX: number; scaleY: number } {
  // Calculate the widths of top and bottom edges
  const topWidth = Math.sqrt(
    Math.pow(edges.topRight.x - edges.topLeft.x, 2) +
    Math.pow(edges.topRight.y - edges.topLeft.y, 2)
  );
  const bottomWidth = Math.sqrt(
    Math.pow(edges.bottomRight.x - edges.bottomLeft.x, 2) +
    Math.pow(edges.bottomRight.y - edges.bottomLeft.y, 2)
  );

  // Calculate the heights of left and right edges
  const leftHeight = Math.sqrt(
    Math.pow(edges.bottomLeft.x - edges.topLeft.x, 2) +
    Math.pow(edges.bottomLeft.y - edges.topLeft.y, 2)
  );
  const rightHeight = Math.sqrt(
    Math.pow(edges.bottomRight.x - edges.topRight.x, 2) +
    Math.pow(edges.bottomRight.y - edges.topRight.y, 2)
  );

  // If there's significant perspective distortion, calculate correction
  const widthRatio = Math.min(topWidth, bottomWidth) / Math.max(topWidth, bottomWidth);
  const heightRatio = Math.min(leftHeight, rightHeight) / Math.max(leftHeight, rightHeight);

  return {
    scaleX: widthRatio < 0.95 ? 1 / widthRatio : 1,
    scaleY: heightRatio < 0.95 ? 1 / heightRatio : 1,
  };
}

/**
 * Apply perspective correction to a scanned image
 *
 * @param imageUri - URI of the image to correct
 * @param edges - Detected document edges (optional)
 * @param targetWidth - Target output width (default: 1700 for ~200 DPI A4)
 */
export async function applyPerspectiveCorrection(
  imageUri: string,
  edges?: DetectedEdges,
  targetWidth: number = 1700
): Promise<PerspectiveCorrectionResult> {
  try {
    const actions: ImageManipulator.Action[] = [];
    let wasTransformed = false;

    // Step 1: If edges are detected with high confidence, crop to document
    if (edges && edges.confidence > 0.7) {
      // Get image dimensions first
      const imageInfo = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG }
      );

      // Calculate and apply rotation
      const rotationAngle = calculateRotationAngle(edges);
      if (Math.abs(rotationAngle) > 0.5) {
        actions.push({ rotate: rotationAngle });
        wasTransformed = true;
      }

      // Calculate crop region
      const cropRegion = calculateBoundingBox(edges, imageInfo.width, imageInfo.height);

      // Validate crop region
      if (
        cropRegion.width > 100 &&
        cropRegion.height > 100 &&
        cropRegion.originX >= 0 &&
        cropRegion.originY >= 0
      ) {
        actions.push({ crop: cropRegion });
        wasTransformed = true;
      }
    }

    // Step 2: Resize to target width while maintaining aspect ratio
    actions.push({ resize: { width: targetWidth } });

    // Apply all transformations
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      actions,
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      wasTransformed,
    };
  } catch (error) {
    console.error('Perspective correction failed:', error);
    // Return original image on failure
    return {
      uri: imageUri,
      width: 0,
      height: 0,
      wasTransformed: false,
    };
  }
}

/**
 * Auto-enhance document image (contrast, brightness, etc.)
 */
export async function autoEnhanceDocument(imageUri: string): Promise<string> {
  try {
    // Note: expo-image-manipulator doesn't support direct contrast/brightness
    // In a production app, consider using react-native-image-filter-kit or similar
    // For now, we just ensure good quality compression
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      {
        compress: 0.95,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (error) {
    console.error('Auto-enhance failed:', error);
    return imageUri;
  }
}

/**
 * Detect if the image needs rotation based on EXIF or content
 */
export async function detectAndFixOrientation(imageUri: string): Promise<string> {
  try {
    // expo-image-manipulator automatically handles EXIF orientation
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.error('Orientation fix failed:', error);
    return imageUri;
  }
}

/**
 * Full document processing pipeline
 */
export async function processScannedDocument(
  imageUri: string,
  edges?: DetectedEdges,
  options?: {
    targetWidth?: number;
    autoEnhance?: boolean;
    fixOrientation?: boolean;
  }
): Promise<PerspectiveCorrectionResult> {
  const {
    targetWidth = 1700,
    autoEnhance = true,
    fixOrientation = true,
  } = options || {};

  let processedUri = imageUri;

  // Step 1: Fix orientation if needed
  if (fixOrientation) {
    processedUri = await detectAndFixOrientation(processedUri);
  }

  // Step 2: Apply perspective correction
  const correctionResult = await applyPerspectiveCorrection(
    processedUri,
    edges,
    targetWidth
  );

  // Step 3: Auto-enhance if requested
  if (autoEnhance) {
    correctionResult.uri = await autoEnhanceDocument(correctionResult.uri);
  }

  return correctionResult;
}

export type { DetectedEdges, Point, CropRegion, PerspectiveCorrectionResult };
