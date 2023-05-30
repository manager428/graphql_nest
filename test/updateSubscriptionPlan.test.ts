import { User } from '@sirge-io/sirge-utils';
import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  UpdateSubscriptionPlanParams,
} from '../shared/types';
import { handler } from './../lambda-handlers/update-subscription-plan';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<User>>;

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

  it('verifies successfull response', async () => {
    const event = buildTestEvent<UpdateSubscriptionPlanParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff6b',
      group: 'Managers',
      requestPayload: {
        updateSubscriptionPlanInput: {
          to_plan_code: 'bolt_basic',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<User>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toBeDefined();
    expect(message).toEqual('Plan changed successfully');
  });
});
