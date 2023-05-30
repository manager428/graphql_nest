import { Callback } from 'aws-lambda';
import AWS from 'aws-sdk';
import { Result, SuccessResponse } from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import { handler } from '../lambda-handlers/disconnect-tik-tok';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { DisconnectTikTokParams } from '../lambda-handlers/disconnect-tik-tok';

require('dotenv').config();

describe('Test for app handler', () => {
  beforeAll(() => {
    if (process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
      AWS.config.update({
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
        region: 'us-west-2',
      });
    }
  });

  it('verifies successful response', async () => {
    const event = buildTestEvent<DisconnectTikTokParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Managers',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {},
    });

    const context = getTestContext();

    const callback: Callback<Result<User>> = () => {};

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<User>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.tik_tok_access_token).toBeNull();

    expect(message).toEqual('Tik Tok account disconnected');
  });
});
