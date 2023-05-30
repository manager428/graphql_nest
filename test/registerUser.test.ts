import { Callback, Context } from 'aws-lambda';
import { RegisterUserParams, Result, SuccessResponse } from '../shared/types';
import { handler } from '../lambda-handlers/register-user';
import { buildTestEvent } from './helpers/buildTestEvent';
import { createStripePaymentMethod } from '../shared/stripe';
import { getTestContext } from './helpers/getTestContext';
import { cognitoRegister } from './helpers/mocks/cognitoRegister';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<null>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('verifies successful staff account response', async () => {
    const cardNumber = '4242424242424242';
    const cardType = 'visa';
    const expMonth = 10;
    const expYear = new Date().getFullYear() + 2;

    const paymentMethod = await createStripePaymentMethod({
      type: 'card',
      card: {
        number: cardNumber,
        exp_month: expMonth,
        exp_year: expYear,
        cvc: '315',
      },
    });

    const event = buildTestEvent<RegisterUserParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        registerUserInput: {
          first_name: 'someTestUser',
          last_name: 'someTestUser',
          email: `andreas+manager${new Date().getTime()}@sirge.io`,
          password: 'P@ssword1',
          card_expiry_date: `${expMonth}/${expYear}`,
          card_last_four_digits: cardNumber.slice(11, 4),
          card_type: cardType,
          city: 'Cupertino',
          country_code: 'US',
          country_name: 'US',
          full_address: '3701 Alness Street',
          line1: '1 Apple Park Way',
          payment_method: paymentMethod.id,
          plan_code: 'bolt_pro_2_annually',
          postal_code: '95014',
          state: 'California',
          timezone:'GMT',
          currency:'USD'
        },
      },
    });

    cognitoRegister();

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('User created successfully');
  });
});
