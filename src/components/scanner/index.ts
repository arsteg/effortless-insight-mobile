/**
 * Scanner Components
 *
 * Export all document scanning related components.
 */

export { DocumentScanner } from './DocumentScanner';
export { MultiPageScanner } from './MultiPageScanner';

// Types
export interface DetectedEdge {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
  confidence: number;
}

export interface ScannedPage {
  id: string;
  uri: string;
  thumbnailUri?: string;
  timestamp: number;
}
