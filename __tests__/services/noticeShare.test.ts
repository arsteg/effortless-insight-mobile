/**
 * Notice sharing — TC-MOB-042.
 *
 * Sharing pushes confidential tax data outside the app where it cannot be
 * revoked, so these tests are as much about what must NOT be shared, and by
 * whom, as about formatting.
 */
import {
  buildNoticeShareMessage,
  buildNoticeShareTitle,
  canShareNotice,
  type ShareableNotice,
} from '../../src/utils/noticeShare';

const NOTICE: ShareableNotice = {
  id: 'n1',
  noticeNumber: 'ZA0712180000067X',
  noticeType: 'GSTR-3B Mismatch',
  gstin: '07APIPS0052D410',
  status: 'in_progress',
  responseDeadline: '2026-09-15T00:00:00Z',
  issuingAuthority: 'Delhi GST Commissionerate',
};

describe('canShareNotice — expected result 4, "respects permissions"', () => {
  it.each(['owner', 'admin', 'manager', 'ca'])('allows %s', (role) => {
    expect(canShareNotice(role)).toBe(true);
  });

  it('blocks a viewer, who may read but not redistribute', () => {
    expect(canShareNotice('viewer')).toBe(false);
  });

  it('blocks a plain member', () => {
    expect(canShareNotice('member')).toBe(false);
  });

  it('blocks an absent or unknown role rather than defaulting open', () => {
    expect(canShareNotice(undefined)).toBe(false);
    expect(canShareNotice(null)).toBe(false);
    expect(canShareNotice('')).toBe(false);
    expect(canShareNotice('something_new')).toBe(false);
  });
});

describe('buildNoticeShareMessage', () => {
  it('includes the identifiers a recipient needs', () => {
    const message = buildNoticeShareMessage(NOTICE);

    expect(message).toContain('ZA0712180000067X');
    expect(message).toContain('07APIPS0052D410');
    expect(message).toContain('GSTR-3B Mismatch');
    expect(message).toContain('Delhi GST Commissionerate');
  });

  it('makes the status readable rather than a raw enum', () => {
    expect(buildNoticeShareMessage(NOTICE)).toContain('Status: in progress');
  });

  it('formats the deadline as a date, not an ISO string', () => {
    const message = buildNoticeShareMessage(NOTICE);

    expect(message).toContain('Response deadline:');
    expect(message).not.toContain('2026-09-15T00:00:00Z');
  });

  it('appends the deep link when one is supplied', () => {
    const message = buildNoticeShareMessage(NOTICE, 'effortlessinsight://notices/n1');

    expect(message).toContain('effortlessinsight://notices/n1');
  });

  it('omits the link line entirely when none is supplied', () => {
    expect(buildNoticeShareMessage(NOTICE)).not.toContain('Open in EffortlessInsight');
  });

  it('never leaks "undefined" for missing optional fields', () => {
    const sparse: ShareableNotice = { id: 'n2', status: 'uploaded' };

    const message = buildNoticeShareMessage(sparse);

    expect(message).not.toMatch(/undefined|null|NaN/);
    expect(message).toContain('Status: uploaded');
  });

  it('drops an unparseable deadline instead of printing "Invalid Date"', () => {
    const message = buildNoticeShareMessage({ ...NOTICE, responseDeadline: 'not-a-date' });

    expect(message).not.toMatch(/Invalid Date/);
    expect(message).not.toContain('Response deadline:');
  });
});

describe('what must NOT leave the app', () => {
  it('carries no demand amount, AI analysis or attachment content', () => {
    // The DTO has these fields; the share payload deliberately does not accept
    // them, so they cannot be added by accident at the call site.
    const withExtras = {
      ...NOTICE,
      demandAmount: 4500000,
      aiSummary: 'Confidential AI assessment of exposure',
    } as ShareableNotice & Record<string, unknown>;

    const message = buildNoticeShareMessage(withExtras);

    expect(message).not.toContain('4500000');
    expect(message).not.toContain('Confidential');
  });
});

describe('buildNoticeShareTitle', () => {
  it('names the notice when it has a number', () => {
    expect(buildNoticeShareTitle(NOTICE)).toBe('GST Notice ZA0712180000067X');
  });

  it('falls back gracefully without one', () => {
    expect(buildNoticeShareTitle({ id: 'n3', status: 'uploaded' })).toBe('GST Notice');
  });
});
