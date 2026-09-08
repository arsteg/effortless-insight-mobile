/**
 * Notice status transitions — TC-MOB-040.
 *
 * Mirrors the server's NoticeWorkflowService map. The bug these guard against:
 * the client offered every status, so the SECOND change attempted an illegal
 * move and the API returned 400 INVALID_TRANSITION.
 */
import {
  getAllowedTransitions,
  isTransitionAllowed,
  transitionRequiresReason,
  statusLabel,
} from '../../src/utils/noticeStatus';

describe('getAllowedTransitions mirrors the server map', () => {
  it.each([
    ['uploaded', ['processing', 'failed']],
    ['processing', ['analyzed', 'failed']],
    ['analyzed', ['in_progress', 'archived', 'closed']],
    ['in_progress', ['responded', 'analyzed']],
    ['responded', ['closed', 'in_progress']],
    ['closed', ['archived']],
    ['failed', ['processing', 'archived']],
    ['archived', ['analyzed']],
  ])('from %s', (from, expected) => {
    expect(getAllowedTransitions(from)).toEqual(expected);
  });

  it('returns nothing for an unknown or missing status', () => {
    expect(getAllowedTransitions('nonsense')).toEqual([]);
    expect(getAllowedTransitions(undefined)).toEqual([]);
    expect(getAllowedTransitions(null)).toEqual([]);
  });

  it('never offers the status it is already in', () => {
    for (const status of ['uploaded', 'processing', 'analyzed', 'in_progress',
                          'responded', 'closed', 'failed', 'archived']) {
      expect(getAllowedTransitions(status)).not.toContain(status);
    }
  });
});

describe('the exact sequence that produced the 400', () => {
  it('allows analyzed -> in_progress, then in_progress -> responded', () => {
    expect(isTransitionAllowed('analyzed', 'in_progress')).toBe(true);
    expect(isTransitionAllowed('in_progress', 'responded')).toBe(true);
  });

  it('blocks the illegal second hop the old list offered', () => {
    // Once in_progress, the old code still offered uploaded/processing/etc.
    expect(isTransitionAllowed('in_progress', 'uploaded')).toBe(false);
    expect(isTransitionAllowed('in_progress', 'processing')).toBe(false);
    expect(isTransitionAllowed('in_progress', 'closed')).toBe(false);
    expect(isTransitionAllowed('in_progress', 'archived')).toBe(false);
  });

  it('blocks skipping the workflow entirely', () => {
    expect(isTransitionAllowed('uploaded', 'responded')).toBe(false);
    expect(isTransitionAllowed('uploaded', 'closed')).toBe(false);
  });
});

describe('transitionRequiresReason', () => {
  it.each([
    ['analyzed', 'closed'],
    ['in_progress', 'analyzed'],
    ['responded', 'in_progress'],
    ['failed', 'archived'],
    ['archived', 'analyzed'],
  ])('%s -> %s needs a reason', (from, to) => {
    expect(transitionRequiresReason(from, to)).toBe(true);
  });

  it('does not demand a reason for ordinary forward moves', () => {
    expect(transitionRequiresReason('analyzed', 'in_progress')).toBe(false);
    expect(transitionRequiresReason('in_progress', 'responded')).toBe(false);
    expect(transitionRequiresReason('responded', 'closed')).toBe(false);
  });
});

describe('statusLabel', () => {
  it('renders enum values as readable text', () => {
    expect(statusLabel('in_progress')).toBe('In Progress');
    expect(statusLabel('uploaded')).toBe('Uploaded');
  });

  it('degrades sensibly for anything unrecognised', () => {
    expect(statusLabel('some_new_status')).toBe('some new status');
    expect(statusLabel(undefined)).toBe('Unknown');
  });
});
