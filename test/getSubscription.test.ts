import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import { Result, SuccessResponse } from '../shared/types';
import {
  GetSubscriptionParams,
  SubscriptionObjectResponse,
  handler,
} from './../lambda-handlers/get-subscription';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<SubscriptionObjectResponse>>;

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
    const event = buildTestEvent<GetSubscriptionParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<SubscriptionObjectResponse>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toBeDefined();
    expect(message).toEqual('Subscription fetched succesfully');
  });
});
