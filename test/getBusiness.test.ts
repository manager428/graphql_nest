import AWS from 'aws-sdk';
import { AppSyncResolverEvent, Callback, Context } from 'aws-lambda';
import { handler } from './../lambda-handlers/get-business-by-user-id';
import { Result, SuccessResponse } from '../shared/types';
import { Business } from '@sirge-io/sirge-utils';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { GetBusinessByUserIdParams } from '../lambda-handlers/get-business-by-user-id';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<Business[]>>;

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
    const event = buildTestEvent<GetBusinessByUserIdParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      Business[]
    >;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();
    expect(message).toEqual('Businesses returned');
  });
});
