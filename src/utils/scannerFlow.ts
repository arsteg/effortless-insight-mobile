/**
 * Scanner screen-selection rules.
 *
 * Extracted from the scanner screen because the multi-page flow is driven by a
 * boolean gate that is easy to get subtly wrong and impossible to unit-test
 * while it sits inline in a 1,300-line component. It previously read:
 *
 *   scanState === 'pages' || (isMultiPageMode && pages.length > 0 && scanState === 'camera')
 *
 * which routed 'camera' to the REVIEW screen as soon as one page existed — so
 * the camera could never be reached again and "Add Another Page" appeared dead
 * (TC-MOB-023).
 */

export type ScanState =
  | 'camera'
  | 'preview'
  | 'crop'
  | 'pages'
  | 'enhancing'
  | 'uploading'
  | 'success'
  | 'error';

/**
 * Whether to render the multi-page review list.
 *
 * Only ever true for the explicit 'pages' state. The camera state must always
 * render the camera, otherwise capturing a second page is impossible.
 */
export function shouldShowPagesReview(scanState: ScanState): boolean {
  return scanState === 'pages';
}

/**
 * Whether the camera should show the "N pages" badge that opens the review
 * list — only meaningful once multi-page mode has collected something.
 */
export function shouldShowPagesBadge(isMultiPageMode: boolean, pageCount: number): boolean {
  return isMultiPageMode && pageCount > 0;
}

/**
 * Move a page one position earlier or later.
 *
 * Page order is not cosmetic: `generatePdfFromPages` merges pages in array
 * order, so this decides the page order of the document sent for OCR and AI
 * analysis (TC-MOB-024). Returns the original array when the move would fall
 * off either end, so callers can assign the result unconditionally.
 */
export function reorderPage<T>(pages: T[], fromIndex: number, direction: 'up' | 'down'): T[] {
  const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
  if (fromIndex < 0 || fromIndex >= pages.length) return pages;
  if (toIndex < 0 || toIndex >= pages.length) return pages;

  const next = [...pages];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return next;
}
