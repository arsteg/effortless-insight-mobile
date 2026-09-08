/**
 * Offline / unreachable-server messaging — TC-MOB-006.
 *
 * Exercises the real client helpers; before this, users saw axios' raw
 * "Network Error" and "timeout of 30000ms exceeded" strings.
 */
import { AxiosError, AxiosHeaders } from 'axios';
import {
  getApiErrorMessage,
  isNetworkError,
  NO_INTERNET_MESSAGE,
  TIMEOUT_MESSAGE,
} from '../../src/services/api/client';

const config = () => ({ headers: new AxiosHeaders() }) as never;

/** What axios throws in RN when the request never leaves the device. */
function offlineError(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK', config(), {});
}

function timeoutError(): AxiosError {
  return new AxiosError('timeout of 30000ms exceeded', 'ECONNABORTED', config(), {});
}

function rejectedCredentials(): AxiosError {
  return new AxiosError('Request failed with status code 401', '401', config(), {}, {
    status: 401,
    statusText: 'Unauthorized',
    data: { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    headers: {},
    config: config(),
  });
}

describe('offline error messaging', () => {
  it('reports a clear message with no connectivity', () => {
    expect(getApiErrorMessage(offlineError())).toBe(NO_INTERNET_MESSAGE);
    expect(NO_INTERNET_MESSAGE).toBe('No internet connection');
  });

  it('distinguishes a timeout from being offline', () => {
    expect(getApiErrorMessage(timeoutError())).toBe(TIMEOUT_MESSAGE);
  });

  it('never leaks axios internals to the user', () => {
    for (const err of [offlineError(), timeoutError()]) {
      const message = getApiErrorMessage(err);
      expect(message).not.toMatch(/Network Error|ECONNABORTED|axios|30000ms/i);
    }
  });

  it('still surfaces real server messages untouched', () => {
    expect(getApiErrorMessage(rejectedCredentials())).toBe('Invalid email or password');
  });
});

describe('isNetworkError — decides whether a retry is offered', () => {
  it('is true when the request never reached the server', () => {
    expect(isNetworkError(offlineError())).toBe(true);
    expect(isNetworkError(timeoutError())).toBe(true);
  });

  it('is false when the server answered', () => {
    // A 401 must NOT be treated as a network failure, or the password would
    // survive a genuine rejection (TC-MOB-002).
    expect(isNetworkError(rejectedCredentials())).toBe(false);
  });

  it('is false for non-axios errors', () => {
    expect(isNetworkError(new Error('boom'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
