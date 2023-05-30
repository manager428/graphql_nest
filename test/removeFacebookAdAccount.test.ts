import { User } from '@sirge-io/sirge-utils';
import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  handler,
  RemoveFacebookAdAccountParams,
} from '../lambda-handlers/remove-facebook-ad-account';
import { setFacebookAdAccountInfo } from '../shared/mongoDb';
import { ErrorResponse, Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

type ErrorResult = {
  error: { code: number; message: string };
};

describe('test setting facebook account access', () => {
  let context: Context;
  let callback: Callback<Result<User | null>>;

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

  it('should remove business facebook ad account info', async () => {
    const event = buildTestEvent<RemoveFacebookAdAccountParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        removeFacebookAdAccountInput: {
          business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
        },
      },
    });

    //resets the business and populates it with data
    await setFacebookAdAccountInfo({
      business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
      fb_pixel_id: 377907384345199,
      facebook_ad_account_id: 'act_816047699455990',
      facebook_ad_account_name: 'Vi',
      facebook_ad_account_currency: 'USD',
      facebook_ad_account_timezone: 'America/Chicago',
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('Facebook ad account removed.');
  });

  it('should fail removing business facebook ad account info', async () => {
    const event = buildTestEvent<RemoveFacebookAdAccountParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        removeFacebookAdAccountInput: {
          business_id: '142ddabf-b4bb-4d6f-ae83-2f9275ae575f',
        },
      },
    });

    try {
      const result = (await handler(event, context, callback)) as ErrorResponse; // Expecting a response, so AS it

      const {
        error: { code, message },
      } = result;

      expect(code).toEqual(3);
      expect(message).toEqual('No business found.');
    } catch (error) {
      console.log(error);
    }
  });
});
