/**
 * TC-MOB-048 — when task deadline reminders fire.
 */

import { planReminders, REMINDER_HOUR } from '../../src/utils/taskReminders';

/** 1 Sep 2026, 08:00 local. */
const now = new Date(2026, 8, 1, 8, 0, 0);

/** A due date at the end of the given local day, as the app stores them. */
const dueOn = (year: number, month: number, day: number) =>
  new Date(year, month, day, 23, 59, 59).toISOString();

describe('planReminders', () => {
  it('returns nothing when there is no due date', () => {
    expect(planReminders('Task', undefined, 'medium', now)).toEqual([]);
  });

  it('returns nothing for an unparseable due date rather than throwing', () => {
    expect(planReminders('Task', 'not-a-date', 'medium', now)).toEqual([]);
  });

  it('schedules one day-of reminder for a normal priority', () => {
    const plans = planReminders('Task', dueOn(2026, 8, 10), 'medium', now);
    expect(plans).toHaveLength(1);
    expect(plans[0].kind).toBe('day-of');
  });

  it('fires in the morning, not at the deadline itself', () => {
    // Firing at 23:59 on the due date leaves no time to act on it.
    const plans = planReminders('Task', dueOn(2026, 8, 10), 'medium', now);
    expect(plans[0].fireAt.getHours()).toBe(REMINDER_HOUR);
    expect(plans[0].fireAt.getDate()).toBe(10);
  });

  it.each(['critical', 'high'])(
    'adds a day-before reminder for %s priority',
    (priority) => {
      const plans = planReminders('Task', dueOn(2026, 8, 10), priority, now);
      expect(plans).toHaveLength(2);
      expect(plans.map((p) => p.kind)).toEqual(['day-before', 'day-of']);
      expect(plans[0].fireAt.getDate()).toBe(9);
    }
  );

  it.each(['medium', 'low'])('does not add a day-before for %s priority', (priority) => {
    const plans = planReminders('Task', dueOn(2026, 8, 10), priority, now);
    expect(plans.map((p) => p.kind)).toEqual(['day-of']);
  });

  it('orders the day-before reminder first', () => {
    const plans = planReminders('Task', dueOn(2026, 8, 10), 'critical', now);
    expect(plans[0].fireAt.getTime()).toBeLessThan(plans[1].fireAt.getTime());
  });

  it('drops a fire time already in the past', () => {
    // A task due today at 23:59, created at 08:00, still gets its 09:00 nudge.
    const sameDay = planReminders('Task', dueOn(2026, 8, 1), 'medium', now);
    expect(sameDay).toHaveLength(1);

    // Created at 14:00, the 09:00 slot has gone — expo fires a past DATE
    // trigger immediately, which would alert the user as they hit save.
    const afternoon = new Date(2026, 8, 1, 14, 0, 0);
    expect(planReminders('Task', dueOn(2026, 8, 1), 'medium', afternoon)).toEqual([]);
  });

  it('drops the day-before but keeps the day-of when only the former has passed', () => {
    const plans = planReminders('Task', dueOn(2026, 8, 2), 'critical', now);
    // Day-before would be 09:00 on the 1st; it is 08:00 now, so it survives.
    expect(plans).toHaveLength(2);

    const later = new Date(2026, 8, 1, 10, 0, 0);
    const remaining = planReminders('Task', dueOn(2026, 8, 2), 'critical', later);
    expect(remaining.map((p) => p.kind)).toEqual(['day-of']);
  });

  it('returns nothing when the whole due date has passed', () => {
    expect(planReminders('Task', dueOn(2026, 7, 20), 'critical', now)).toEqual([]);
  });

  it('crosses a month boundary for the day-before reminder', () => {
    const plans = planReminders('Task', dueOn(2026, 9, 1), 'critical', now);
    expect(plans[0].fireAt.getMonth()).toBe(8); // September
    expect(plans[0].fireAt.getDate()).toBe(30);
  });

  it('puts the task title in the notification so it is actionable', () => {
    const plans = planReminders('File GSTR-3B reply', dueOn(2026, 8, 10), 'high', now);
    plans.forEach((plan) => {
      expect(plan.title).toContain('File GSTR-3B reply');
    });
  });

  it('distinguishes the two notifications by wording', () => {
    const plans = planReminders('Task', dueOn(2026, 8, 10), 'critical', now);
    expect(plans[0].title).toContain('tomorrow');
    expect(plans[1].title).toContain('today');
  });

  it('names the priority in the body', () => {
    const plans = planReminders('Task', dueOn(2026, 8, 10), 'critical', now);
    expect(plans[0].body).toContain('Critical');
  });
});
