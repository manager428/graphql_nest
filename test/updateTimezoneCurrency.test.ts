import { Callback } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  UpdateTimezoneCurrencyParams,
} from '../shared/types';
import { handler } from './../lambda-handlers/update-timezone-currency';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
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
    const event = buildTestEvent<UpdateTimezoneCurrencyParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        updateTimezoneCurrencyInput: {
          timezone: 'america/chicago',
          currency: 'usd',
        },
      },
    });

    const context = getTestContext();

    const callback: Callback<Result<null>> = () => {};

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual(`Timezone and Currency selected.`);
  });
});
