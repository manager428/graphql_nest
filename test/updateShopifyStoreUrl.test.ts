import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  UpdateShopifyUrlParams,
} from '../shared/types';
import { handler } from './../lambda-handlers/update-shopify-store-url';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<null>>;

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

  it('verifies successfull response', async () => {
    const event = buildTestEvent<UpdateShopifyUrlParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff6b',
      group: 'Managers',
      requestPayload: {
        updateShopifyStoreUrlInput: {
          business_id: '69daf650-961f-42ef-9c24-906efba052f0',
          shopify_url: 'https://example.com',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toBeDefined();
    expect(message).toEqual('Shopify url successfully updated');
  });
});
