import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  GetBusinessAnalyticsParams,
} from '../shared/types';
import { handler } from './../lambda-handlers/get-business-analytics';
import { Analytics } from '@sirge-io/sirge-types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

jest.setTimeout(20_000);

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<Analytics>>;

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
    const event = buildTestEvent<GetBusinessAnalyticsParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getbusinessAnalyticsInput: {
          business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<Analytics>;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toBeDefined();
    expect(message).toEqual('Business analytics data fetched successfully.');
  });
});
