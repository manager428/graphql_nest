import { User } from '@sirge-io/sirge-utils';
import { Callback, Context } from 'aws-lambda';
import {
  handler,
  SetFacebookAdAccountParams,
} from '../lambda-handlers/set-facebook-ad-account';
import { ErrorResponse, Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

describe('test setting facebook account access', () => {
  let context: Context;
  let callback: Callback<Result<User | null>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('should fail facebook ad account set', async () => {
    // @ts-ignore - We only need ok and json()
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue({ access_token: 'someRandomFakeTestAccessToken' }),
    });

    const event = buildTestEvent<SetFacebookAdAccountParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        setFacebookAdAccountInput: {
          business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
          facebook_ad_account_id: 'act_816047699455990',
          facebook_ad_account_name: 'Vi',
          facebook_ad_account_currency: 'USD',
        },
      },
    });

    const result = (await handler(event, context, callback)) as ErrorResponse; // Expecting a response, so AS it

    const {
      error: { code, message },
    } = result;

    expect(code).toEqual(68);
    expect(message).toEqual('Performance: Facebook returned no results.');
  });

  it('should set facebook ad account', async () => {
    // @ts-ignore - We only need ok and json()
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValue({ timezone_name: 'TZ_AMERICA_LOS_ANGELES' }),
    });

    const event = buildTestEvent<SetFacebookAdAccountParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        setFacebookAdAccountInput: {
          business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
          facebook_ad_account_id: 'act_816047699455990',
          facebook_ad_account_name: 'Vi',
          facebook_ad_account_currency: 'USD',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('Facebook ad account set.');
  });
});
