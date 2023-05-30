import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { handler } from './../lambda-handlers/get-tiktok-ads';
import { TikTokAdParams, Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { TikTokAdSet } from '@sirge-io/sirge-utils';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<TikTokAdSet[] | null>>;

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
    const event = buildTestEvent<TikTokAdParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        TikTokAdInput: {
          business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
          date_from: new Date(),
          date_to: new Date(),
          source: ['Tiktok'],
          selected_campaigns: [6288836506060, 6288836506061],
          selected_ad_sets: [6288836506460],
        },
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      TikTokAdSet[]
    >;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toEqual(`Ad retrieved successfully`);
  });
});
