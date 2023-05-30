import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import {
  GetBusinessCampaignsParams,
  handler,
} from './../lambda-handlers/get-business-campaings';
import { Result, SuccessResponse } from '../shared/types';
import { CampaignsTikTok } from '@sirge-io/sirge-utils';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<CampaignsTikTok[] | null>>;

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
    const event = buildTestEvent<GetBusinessCampaignsParams>({
      userId: 'dbbf6b33-64aa-45f5-bb6f-da449b50f287',
      group: 'Managers',
      requestPayload: {
        business_id: 'c7a5cb5d-d0da-48db-8b28-c0a954074ebf',
        date_from: '2022-06-04',
        date_to: '2022-12-04',
        selected_campaigns: '[]',
        source: 'facebook',
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      CampaignsTikTok[]
    >;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toEqual(`Facebook Campaigns for business found.`);
  });
});
