import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { handler } from './../lambda-handlers/activate-business';
import {
  Result,
  ActivateBusinessParams,
  SuccessResponse,
} from '../shared/types';
import { getTestContext } from './helpers/getTestContext';
import { buildTestEvent } from './helpers/buildTestEvent';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<null>>;

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
    const event = buildTestEvent<ActivateBusinessParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Managers',
      requestPayload: {
        activateBusinessInput: {
          business_id: '8c6479b1-3778-4994-ba1e-39ebe93b73ad',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual(`Business activated.`);
  });
});
