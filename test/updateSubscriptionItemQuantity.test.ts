import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  ItemQuantityResult,
  UpdateSubscriptionItemQuantityParams,
} from '../shared/types';
import { handler } from './../lambda-handlers/update-subscription-item-quantity';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<ItemQuantityResult>>;

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
    const event = buildTestEvent<UpdateSubscriptionItemQuantityParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        subscription_id: 'sub_1JwkexBWXgc6iQOCEZk2iLy0',
        subscription_item_id: 'si_KbycZKybUdfUrC',
        option: 200,
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<ItemQuantityResult>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toBeDefined();
    expect(message).toEqual('Trial ended.');
  });
});
