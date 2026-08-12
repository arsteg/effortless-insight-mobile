/**
 * PDF Generator Utility
 *
 * Generates real, valid multi-page PDF documents from scanned images using
 * pdf-lib (pure JS — no native module). Previously this wrote a JSON manifest of
 * local file:// URIs and mislabeled it as a PDF, which the server could not
 * process (audit B1).
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { PDFDocument } from 'pdf-lib';

interface ScannedPage {
  id: string;
  uri: string;
  timestamp: number;
}

interface PdfGenerationResult {
  success: boolean;
  pdfUri?: string;
  pageCount?: number;
  fileSizeBytes?: number;
  error?: string;
}

/**
 * Generate PDF from scanned pages
 */
export async function generatePdfFromPages(
  pages: ScannedPage[],
  options?: {
    filename?: string;
    quality?: number;
  }
): Promise<PdfGenerationResult> {
  if (pages.length === 0) {
    return {
      success: false,
      error: 'No pages provided',
    };
  }

  const filename = options?.filename || `document_${Date.now()}.pdf`;

  try {
    const pdfDoc = await PDFDocument.create();

    for (const page of pages) {
      // Resize + compress each scan to a JPEG (base64), then embed it.
      const processed = await ImageManipulator.manipulateAsync(
        page.uri,
        [{ resize: { width: 1700 } }], // ~200 DPI for A4
        {
          compress: options?.quality ?? 0.85,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      if (!processed.base64) continue;

      const image = await pdfDoc.embedJpg(processed.base64);
      // One page per image, sized to the image so the scan fills it 1:1.
      const pdfPage = pdfDoc.addPage([image.width, image.height]);
      pdfPage.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    if (pdfDoc.getPageCount() === 0) {
      return { success: false, error: 'No pages could be processed' };
    }

    const pdfBase64 = await pdfDoc.saveAsBase64();
    const pdfPath = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(pdfPath, pdfBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const fileInfo = await FileSystem.getInfoAsync(pdfPath);

    return {
      success: true,
      pdfUri: pdfPath,
      pageCount: pdfDoc.getPageCount(),
      fileSizeBytes: fileInfo.exists ? fileInfo.size : 0,
    };
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate PDF',
    };
  }
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  uri: string
): Promise<{ width: number; height: number } | null> {
  try {
    // Read image to get dimensions
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error('Failed to get image dimensions:', error);
    return null;
  }
}

/**
 * Estimate PDF file size
 */
export function estimatePdfSize(pageCount: number, avgImageSizeKb: number = 500): number {
  // Rough estimate: images + PDF overhead
  return pageCount * avgImageSizeKb * 1024 + 10 * 1024; // Add 10KB for PDF structure
}

/**
 * Validate pages before PDF generation
 */
export function validatePages(pages: ScannedPage[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (pages.length === 0) {
    errors.push('At least one page is required');
  }

  if (pages.length > 100) {
    errors.push('Maximum 100 pages allowed');
  }

  // Check for duplicate IDs
  const ids = pages.map((p) => p.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    errors.push('Duplicate page IDs detected');
  }

  // Check for valid URIs
  pages.forEach((page, index) => {
    if (!page.uri || page.uri.trim() === '') {
      errors.push(`Page ${index + 1} has invalid URI`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
