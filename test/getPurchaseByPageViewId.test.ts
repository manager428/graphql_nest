import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { BusinessPageViewPurchase, ErrorResponse, GetPageViewParams, Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { handler } from '../lambda-handlers/get-purchase-by-pageviewid';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<BusinessPageViewPurchase>>;

  beforeEach(() => {
    context = getTestContext();

    callback = () => { };
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
    const event = buildTestEvent<GetPageViewParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getPageViewInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
          pageview_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
        },
      },
    });

    const result = (await handler(event, context, callback)) as ErrorResponse;
    const { error } = result;

    expect(error).toBeDefined();
    expect(error).not.toBeNull();
    expect(error?.message).toEqual('No business found.');
  });
});
