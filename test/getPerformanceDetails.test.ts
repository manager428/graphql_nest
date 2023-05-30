import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  GetBusinessPerformanceParams,
} from '../shared/types';
import { handler } from './../lambda-handlers/get-performance-details';
import { Performance } from '@sirge-io/sirge-types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<Performance[]>>;

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
    const event = buildTestEvent<GetBusinessPerformanceParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Managers',
      requestPayload: {
        getPerformanceDetailsInput: {
          business_id:'6f45bcf3-e336-4195-9e52-43c4c9a6ad35',
          itemType:'Campaign',          
          dateStart: '2023-03-01 12:58:22 -0400',
          dateEnd: '2023-03-10 12:58:22 -0400',
        },
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      Performance[]
    >;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toBeDefined();
    expect(message).toEqual('Performance data fetched successfully.');
  });
});
