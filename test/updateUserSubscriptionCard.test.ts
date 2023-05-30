import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import { createStripePaymentMethod } from '../shared/stripe';
import {
  Result,
  SuccessResponse,
  UpdateSubscriptionCardParams,
} from '../shared/types';
import { handler } from './../lambda-handlers/update-user-subscription-card';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

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
    const paymentMethod = await createStripePaymentMethod({
      type: 'card',
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2030,
        cvc: '123',
      },
    });
    const event = buildTestEvent<UpdateSubscriptionCardParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        updateUserSubscriptionCardInput: {
          payment_method: paymentMethod.id,
          card_number: '4242424242424242',
          card_last_four_digits: '4242',
          card_expiry_date: '8/23',
          card_type: 'visa',
          card_cvc: '123',
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
    expect(message).toEqual('Card Changed.');
  });
});
