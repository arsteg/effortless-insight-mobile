/**
 * Multi-page scanner navigation — TC-MOB-023.
 *
 * These pin the exact regression that broke multi-page capture: the review
 * screen used to also claim the 'camera' state once a page existed, so the
 * camera became unreachable and "Add Another Page" did nothing visible.
 */
import {
  shouldShowPagesReview,
  shouldShowPagesBadge,
  reorderPage,
  type ScanState,
} from '../../src/utils/scannerFlow';

describe('shouldShowPagesReview', () => {
  it('shows the review list only for the explicit pages state', () => {
    expect(shouldShowPagesReview('pages')).toBe(true);
  });

  it('NEVER claims the camera state — this is the TC-MOB-023 regression', () => {
    // "Add Another Page" sets 'camera'. If the review screen also matched
    // 'camera', tapping it re-rendered the list and looked like a dead button.
    expect(shouldShowPagesReview('camera')).toBe(false);
  });

  it('leaves every other state to its own screen', () => {
    const others: ScanState[] = [
      'camera', 'preview', 'crop', 'enhancing', 'uploading', 'success', 'error',
    ];
    for (const state of others) {
      expect(shouldShowPagesReview(state)).toBe(false);
    }
  });
});

describe('shouldShowPagesBadge', () => {
  it('shows the count once multi-page mode has collected a page', () => {
    expect(shouldShowPagesBadge(true, 1)).toBe(true);
    expect(shouldShowPagesBadge(true, 7)).toBe(true);
  });

  it('stays hidden before the first capture', () => {
    expect(shouldShowPagesBadge(true, 0)).toBe(false);
  });

  it('stays hidden in single-page mode', () => {
    expect(shouldShowPagesBadge(false, 3)).toBe(false);
  });
});

describe('the multi-page capture loop', () => {
  it('can reach the camera again after every step', () => {
    // Capture page 1 -> handleCapture keeps 'camera' so the user can shoot again.
    expect(shouldShowPagesReview('camera')).toBe(false);
    // Tap the badge -> review the collected pages.
    expect(shouldShowPagesReview('pages')).toBe(true);
    // Tap "Add Another Page" -> back to the camera, not the list.
    expect(shouldShowPagesReview('camera')).toBe(false);
  });
});

describe('reorderPage — decides the page order of the uploaded PDF', () => {
  const pages = ['a', 'b', 'c', 'd'];

  it('moves a page one position earlier', () => {
    expect(reorderPage(pages, 2, 'up')).toEqual(['a', 'c', 'b', 'd']);
  });

  it('moves a page one position later', () => {
    expect(reorderPage(pages, 1, 'down')).toEqual(['a', 'c', 'b', 'd']);
  });

  it('refuses to move the first page earlier', () => {
    expect(reorderPage(pages, 0, 'up')).toEqual(pages);
  });

  it('refuses to move the last page later', () => {
    expect(reorderPage(pages, 3, 'down')).toEqual(pages);
  });

  it('ignores an out-of-range index instead of creating holes', () => {
    expect(reorderPage(pages, 9, 'up')).toEqual(pages);
    expect(reorderPage(pages, -1, 'down')).toEqual(pages);
  });

  it('never mutates the array it was given', () => {
    const original = [...pages];
    reorderPage(pages, 1, 'down');
    expect(pages).toEqual(original);
  });

  it('walks a page from last to first with repeated moves', () => {
    let result = [...pages];
    for (let i = 3; i > 0; i--) result = reorderPage(result, i, 'up');
    expect(result).toEqual(['d', 'a', 'b', 'c']);
  });
});
