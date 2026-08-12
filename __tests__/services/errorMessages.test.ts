/**
 * Tests the REAL error-message helpers from the API client (the previous
 * api.test.ts exercised its own axios mock and never imported app code).
 */
import { AxiosError, AxiosHeaders } from 'axios';
import { getApiErrorMessage, getApiErrorCode } from '../../src/services/api/client';

function makeAxiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    config as never,
    {},
    {
      status,
      statusText: 'Error',
      data,
      headers: {},
      config: config as never,
    }
  );
}

describe('getApiErrorMessage', () => {
  it('prefers the backend envelope message', () => {
    const error = makeAxiosError(400, {
      success: false,
      code: 'EMAIL_EXISTS',
      message: 'An account with this email already exists.',
    });
    expect(getApiErrorMessage(error)).toBe('An account with this email already exists.');
  });

  it('flattens ASP.NET ValidationProblemDetails field errors', () => {
    const error = makeAxiosError(400, {
      title: 'One or more validation errors occurred.',
      errors: {
        Password: ['Password should not contain sequential or repeated characters.'],
        Email: ['Invalid email.'],
      },
    });
    expect(getApiErrorMessage(error)).toBe(
      'Password should not contain sequential or repeated characters.'
    );
  });

  it('falls back to ProblemDetails title when no field errors exist', () => {
    const error = makeAxiosError(400, { title: 'Bad Request' });
    expect(getApiErrorMessage(error)).toBe('Bad Request');
  });

  it('falls back to the axios message for empty bodies', () => {
    const error = makeAxiosError(500, undefined);
    expect(getApiErrorMessage(error)).toBe('Request failed with status code 500');
  });

  it('handles plain Errors and unknown values', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBe('boom');
    expect(getApiErrorMessage('nope')).toBe('An unexpected error occurred');
  });
});

describe('getApiErrorCode', () => {
  it('reads the backend error code', () => {
    const error = makeAxiosError(402, {
      success: false,
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'Subscription required',
    });
    expect(getApiErrorCode(error)).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns null for non-API errors', () => {
    expect(getApiErrorCode(new Error('x'))).toBeNull();
  });
});
