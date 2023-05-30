import { buildTestEvent } from './helpers/buildTestEvent';
import { Callback, Context } from 'aws-lambda';
import { Result, SuccessResponse } from '../shared/types';
import { Usage } from '@sirge-io/sirge-utils';
import { GetUsageParams, handler } from '../lambda-handlers/get-usage';
import AWS from 'aws-sdk';
import { closeConnection } from '../shared/postgresDb';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<Usage | null>>;

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

  afterAll(async () => {
    await closeConnection(); // Close postgres connection so tests do not hang
  });

  it('verifies successful manager response', async () => {
    const event = buildTestEvent<GetUsageParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<Usage>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.total_usage).not.toBeNull();
    expect(message).toEqual('Usage fetched successfully');
  });
});
