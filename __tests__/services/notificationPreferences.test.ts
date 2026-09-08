/**
 * Notification preference wire conversion.
 *
 * The bug these cover: the screen read `channels.email` as a boolean when the
 * API sends `{ enabled: false }`, and wrote a boolean where the API binds an
 * object. Reads always looked ON; writes silently saved nothing.
 */

import {
  channelsFromWire,
  preferencesFromWire,
  channelsToWire,
  updateToWire,
} from '../../src/utils/notificationPreferences';

describe('channelsFromWire', () => {
  it('reads the enabled flag out of the object, not the object itself', () => {
    // The original defect: `{ enabled: false }` is truthy, so the switch was on.
    const channels = channelsFromWire({
      email: { enabled: false },
      push: { enabled: false },
    });
    expect(channels.email).toBe(false);
    expect(channels.push).toBe(false);
  });

  it('keeps a channel that is genuinely enabled', () => {
    expect(channelsFromWire({ email: { enabled: true } }).email).toBe(true);
  });

  it('falls back per channel when the API omits one', () => {
    const channels = channelsFromWire({});
    expect(channels.email).toBe(true);
    expect(channels.push).toBe(true);
    expect(channels.sms).toBe(false);
    expect(channels.whatsApp).toBe(false);
  });

  it('survives a missing channels object entirely', () => {
    expect(channelsFromWire(undefined).email).toBe(true);
  });

  it('takes in-app from the local value, since the API has no such field', () => {
    expect(channelsFromWire({}, false).inApp).toBe(false);
    expect(channelsFromWire({}, true).inApp).toBe(true);
  });
});

describe('channelsToWire', () => {
  it('sends an object per channel, which is what the API binds', () => {
    expect(channelsToWire({ email: false })).toEqual({ email: { enabled: false } });
  });

  it('omits channels the caller did not set', () => {
    // Sending `{ enabled: undefined }` binds to an all-null DTO, which the
    // server reads as "leave unchanged" — the original bug in a new disguise.
    expect(channelsToWire({ email: true })).toEqual({ email: { enabled: true } });
  });

  it('drops inApp, which has no server field', () => {
    expect(channelsToWire({ inApp: false })).toEqual({});
  });

  it('carries every real channel through', () => {
    expect(channelsToWire({ email: true, push: false, sms: true, whatsApp: false })).toEqual({
      email: { enabled: true },
      push: { enabled: false },
      sms: { enabled: true },
      whatsApp: { enabled: false },
    });
  });
});

describe('updateToWire', () => {
  it('renames quiet hours to the API field names', () => {
    const wire = updateToWire({ quietHours: { startTime: '23:00', endTime: '06:00' } });
    expect(wire.quietHours).toEqual({ start: '23:00', end: '06:00' });
  });

  it('nests the daily digest under digest.daily.time', () => {
    const wire = updateToWire({ dailyDigest: { enabled: true, sendTime: '08:30' } });
    expect(wire.digest?.daily).toEqual({ enabled: true, time: '08:30' });
  });

  it('fans a type switch across every channel', () => {
    // Turning a type off must silence it everywhere, not just on email.
    const wire = updateToWire({ typePreferences: { task_assigned: { enabled: false } } as never });
    expect(wire.preferences?.task_assigned).toEqual({
      email: false, sms: false, push: false, whatsApp: false, inApp: false,
    });
  });

  it('sends nothing for an empty update', () => {
    expect(updateToWire({})).toEqual({});
  });

  it('does not send an empty channels object', () => {
    // inApp alone has nothing to tell the server.
    expect(updateToWire({ channels: { inApp: true } }).channels).toBeUndefined();
  });
});

describe('preferencesFromWire', () => {
  it('maps a full response into the screen shape', () => {
    const prefs = preferencesFromWire({
      channels: { email: { enabled: false }, push: { enabled: true } },
      quietHours: { enabled: true, start: '22:30', end: '07:30' },
      digest: { daily: { enabled: true, time: '09:15' } },
      preferences: { task_assigned: { email: false, push: false, inApp: false } },
    });

    expect(prefs.channels.email).toBe(false);
    expect(prefs.channels.push).toBe(true);
    expect(prefs.quietHours.startTime).toBe('22:30');
    expect(prefs.quietHours.endTime).toBe('07:30');
    expect(prefs.dailyDigest.sendTime).toBe('09:15');
    expect(prefs.typePreferences.task_assigned?.enabled).toBe(false);
  });

  it('treats a type as on while any channel still carries it', () => {
    const prefs = preferencesFromWire({
      preferences: { task_assigned: { email: false, push: true } },
    });
    expect(prefs.typePreferences.task_assigned?.enabled).toBe(true);
  });

  it('returns usable defaults for an empty response', () => {
    const prefs = preferencesFromWire({});
    expect(prefs.channels.email).toBe(true);
    expect(prefs.quietHours.enabled).toBe(false);
    expect(prefs.quietHours.startTime).toBe('22:00');
  });

  it('survives a completely absent response', () => {
    expect(() => preferencesFromWire(undefined)).not.toThrow();
  });
});
