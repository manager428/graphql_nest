import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { handler } from './../lambda-handlers/create-business';
import { CreateBusinessParams, Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { Business } from '@sirge-io/sirge-utils';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<Business>>;

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
    const event = buildTestEvent<CreateBusinessParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        createBusinessInput: {
          business_name: 'Lex-Enterprise',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<Business>;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toEqual('Business created successfully.');
  });
});
