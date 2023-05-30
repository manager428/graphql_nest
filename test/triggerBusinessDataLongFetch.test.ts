import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { Result, SuccessResponse } from '../shared/types';
import { Business } from '@sirge-io/sirge-utils';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import {
  handler,
  TriggerBusinessDataLongFetchParams,
} from '../lambda-handlers/trigger-business-data-long-fetch';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<null>>;
  jest.setTimeout(20000);
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
    const event = buildTestEvent<TriggerBusinessDataLongFetchParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        triggerBusinessDataLongFetchInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>;

    const { message } = result;

    expect(message).toEqual('Async long fetch triggered successfully.');
  });
});
