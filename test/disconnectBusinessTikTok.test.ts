import { Callback } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  DisconnectBusinessTikTokParams,
} from '../shared/types';
import { Business } from '@sirge-io/sirge-utils';
import { handler } from './../lambda-handlers/disconnect-business-tik-tok';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

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
    const event = buildTestEvent<DisconnectBusinessTikTokParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Managers',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        disconnectBusinessTiktokInput: {
          business_id: 'c7a5cb5d-d0da-48db-8b28-c0a954074ebf',
        },
      },
    });

    const context = getTestContext();

    const callback: Callback<Result<Business>> = () => {};

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<Business>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.tik_tok_ad_account_id).toBeNull();
    expect(data?.tik_tok_ad_account_name).toBeNull();
    expect(data?.tik_tok_ad_account_currency).toBeNull();
    expect(data?.tik_tok_ad_account_timezone).toBeNull();

    expect(message).toEqual('Ad account disconnected.');
  });
});
