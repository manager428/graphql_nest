import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { handler } from './../lambda-handlers/post-business-tiktok-ad-account';
import {
  AdAccountTikTokParams,
  Result,
  SuccessResponse,
} from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { Business } from '@sirge-io/sirge-utils';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<Business | null>>;

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

  it('verifies successful response', async () => {
    const event = buildTestEvent<AdAccountTikTokParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        AdAccountTiktokBussinesInput: {
          business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
          tik_tok_ad_account_id: '7145915099432189953',
          tik_tok_ad_account_name: 'MRSLIMEY0921',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<Business>;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toEqual(`Ad account set.`);
  });
});
