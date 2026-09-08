/**
 * Verifies the i18n layer actually interpolates {{count}}.
 *
 * The analysis deadline strings depend on it. The codebase had a {{count}} key
 * defined but never called, so the behaviour was unproven until now — an
 * un-interpolated string would ship as a literal "{{count}} days remaining".
 */
import { I18n } from 'i18n-js';
import en from '../../src/i18n/locales/en';
import hi from '../../src/i18n/locales/hi';

const i18n = new I18n({ en, hi });

describe('analysis deadline strings', () => {
  beforeEach(() => {
    i18n.locale = 'en';
  });

  it('interpolates a day count', () => {
    expect(i18n.t('analysis.daysRemaining', { count: 5 })).toBe('5 days remaining');
  });

  it('interpolates an overdue count', () => {
    expect(i18n.t('analysis.overdue', { count: 3 })).toBe('3 days overdue');
  });

  it('never leaves the placeholder visible', () => {
    for (const key of ['analysis.daysRemaining', 'analysis.overdue']) {
      expect(i18n.t(key, { count: 1 })).not.toMatch(/\{\{/);
    }
  });

  it('has the static strings the analysis tab needs', () => {
    expect(i18n.t('analysis.riskAssessment')).toBe('Risk Assessment');
    expect(i18n.t('analysis.responseDeadline')).toBe('Response deadline');
    expect(i18n.t('analysis.dueToday')).toBe('Due today');
    expect(i18n.t('analysis.noDeadline')).toBe('No deadline set');
  });
});

describe('Hindi has every key the analysis tab uses', () => {
  const keys = [
    'analysis.riskAssessment',
    'analysis.riskScore',
    'analysis.responseDeadline',
    'analysis.daysRemaining',
    'analysis.dueToday',
    'analysis.overdue',
    'analysis.noDeadline',
  ];

  it.each(keys)('%s is translated, not falling back to English', (key) => {
    i18n.locale = 'hi';
    const hindi = i18n.t(key, { count: 2 });

    expect(hindi).not.toMatch(/missing|\[/i);
    expect(hindi).not.toMatch(/\{\{/);
    // Devanagari present => genuinely translated rather than copied.
    expect(hindi).toMatch(/[ऀ-ॿ]/);
  });
});
