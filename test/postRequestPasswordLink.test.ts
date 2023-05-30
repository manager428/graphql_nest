import { getTestContext } from './helpers/getTestContext';
import { Callback, Context } from 'aws-lambda';
import {
  ErrorResponse,
  PasswordResetParams,
  Result,
  SuccessResponse,
} from '../shared/types';
import { handler } from '../lambda-handlers/post-request-password-link';
import AWS from 'aws-sdk';
import { buildTestEvent } from './helpers/buildTestEvent';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<boolean>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  beforeAll(() => {
    if (process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
      AWS.config.update({
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
        region: 'us-west-2',
      });
    }
  });

  it('Verifies successful password reset response', async () => {
    const event = buildTestEvent<PasswordResetParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        passwordResetInput: {
          email: 'will@sirge.io',
        },
      },
      useApiKey: true,
    });

    const { data, message } = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<boolean>;

    expect(data).toBe(true);
    expect(message).toContain(event.arguments.passwordResetInput.email);
    expect(message).toBe(
      'Password reset link sent to will+pw+reset+pass@sirge.io. Please check your spam folder.',
    );
  });

  it('Verifies unsuccessful password reset response', async () => {
    const event = buildTestEvent<PasswordResetParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        passwordResetInput: {
          email: 'will+pw+reset+fail@sirge.io',
        },
      },
      useApiKey: true,
    });

    const {
      error: { code, message },
    } = (await handler(event, context, callback)) as ErrorResponse;

    expect(code).toBe(184);
    expect(message).toBe('User password cannot be reset in the current state.');
  });
});
