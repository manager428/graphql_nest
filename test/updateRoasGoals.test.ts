import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import { Result, SuccessResponse } from '../shared/types';
import { handler } from './../lambda-handlers/update-roas-goals';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { UpdateRoasGoalsParams } from '../shared/types';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<null>>;

  jest.setTimeout(20_000);

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
    const event = buildTestEvent<UpdateRoasGoalsParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        updateRoasGoalsInput: {
          analytic_id: '8c6479b1-3778-4994-ba1e-39ebe93b73ad',
          campaigns_goal: 2.3,
          ads_goal: 1.8,
          ad_sets_goal: 3,
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>;

    const { message } = result;

    expect(message).toBeDefined();
    expect(message).toEqual('Roas goals updated');
  });
});
