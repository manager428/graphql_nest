import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import {
  GetBusinessesByUserIdParams,
  handler,
} from '../lambda-handlers/get-businesses-by-user-id';
import { Result, SuccessResponse } from '../shared/types';
import { Business } from '@sirge-io/sirge-utils';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<
    Result<{
      business_list: Business[];
      business_count: number;
      business_active_count: number;
    }>
  >;

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
    const event = buildTestEvent<GetBusinessesByUserIdParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<{
      business_list: Business[];
      business_count: number;
      business_active_count: number;
    }>;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.business_list).toBeDefined();
    expect(data?.business_list).not.toBeNull();

    expect(data?.business_active_count).toBeDefined();
    expect(data?.business_active_count).not.toBeNull();

    expect(data?.business_count).toBeDefined();
    expect(data?.business_count).not.toBeNull();

    expect(message).toEqual('Businesses returned.');
  });
});
