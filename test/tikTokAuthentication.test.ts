import { User } from '@sirge-io/sirge-utils';
import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  handler,
  AuthenticateTikTokParams,
} from '../lambda-handlers/authenticate-tik-tok';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

describe('test user tik tok authentication', () => {
  let context: Context;
  let callback: Callback<Result<User | null>>;

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

  it('should pass a auth code', async () => {
    const event = buildTestEvent<AuthenticateTikTokParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        authenticateTikTokInput: {
          auth_code:
            'EAACBw7i5ZAF0BAJNDD5KtpHF8Hc0iLTSA9TvqAlJhKZC1hcZCUFuMWNwU',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('User Authenticated on Tik Tok');
  });
});
