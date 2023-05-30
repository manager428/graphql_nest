import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { ErrorResponse, GetBusinessParams, Result, SuccessResponse } from '../shared/types';
import { Business } from '@sirge-io/sirge-utils';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { handler } from '../lambda-handlers/get-business-by-businessid';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<Business | null>>;

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
    const event = buildTestEvent<GetBusinessParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getBusinessesInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
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
