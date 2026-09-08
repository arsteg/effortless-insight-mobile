/**
 * TC-MOB-069 — app identity reported to the user and to support.
 */

import {
  formatVersion,
  buildSupportEmailBody,
  copyrightLine,
  SUPPORT_EMAIL,
  AppInfo,
} from '../../src/utils/appInfo';

const info: AppInfo = {
  version: '1.0.1',
  build: '2',
  platform: 'Android',
  osVersion: '34',
};

describe('formatVersion', () => {
  it('shows version and build together', () => {
    // The row previously read "v1.0.0" — hardcoded, and wrong.
    expect(formatVersion(info)).toBe('v1.0.1 (2)');
  });

  it('still renders when the config could not be read', () => {
    expect(formatVersion({ ...info, version: 'unknown', build: 'unknown' })).toBe(
      'vunknown (unknown)'
    );
  });
});

describe('buildSupportEmailBody', () => {
  it('includes the diagnostics support would otherwise have to ask for', () => {
    const body = buildSupportEmailBody(info);
    expect(body).toContain('1.0.1 (2)');
    expect(body).toContain('Android 34');
  });

  it('includes the account when one is known', () => {
    expect(buildSupportEmailBody(info, 'user@example.com')).toContain('user@example.com');
  });

  it('omits the account line entirely when signed out', () => {
    // Better than an empty "Account:" line that looks like a bug.
    expect(buildSupportEmailBody(info)).not.toContain('Account:');
  });

  it('leaves room at the top and says where to write', () => {
    const body = buildSupportEmailBody(info);
    expect(body.startsWith('\n')).toBe(true);
    expect(body).toMatch(/describe the problem above/i);
  });

  it('has a support address to send to', () => {
    expect(SUPPORT_EMAIL).toMatch(/@effortlessinsight\.in$/);
  });
});

describe('copyrightLine', () => {
  it('uses the current year rather than a written-down one', () => {
    // The old string said 2024 and would have kept saying it.
    expect(copyrightLine()).toContain(String(new Date().getFullYear()));
  });

  it('is plain ASCII — the old one carried a double-encoded symbol', () => {
    expect(copyrightLine()).not.toContain('Â');
    expect(copyrightLine()).toContain('©');
  });
});
