import { Callback, Context } from 'aws-lambda';
import { FacebookGrantTypes } from '../shared/facebook';
import {
  handler,
  SetFacebookUserAccessParams,
} from '../lambda-handlers/set-facebook-user-access';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { User } from '@sirge-io/sirge-utils';

describe('test setting facebook account access', () => {
  let context: Context;
  let callback: Callback<Result<User | null>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('should pass token exchange', async () => {
    // @ts-ignore - We only need ok and json()
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token:
          'EAACBw7i5ZAF0BABuIOa0BrLDOKvYSAB1lBCYW19r5NE3x95q49y80HTIgpgU4kN9lKnbuuC83VnmaPxOpIpGacf6xvm50G2VZC8VRxIClaA0l5aOD5eZB79S1MJ7lKkJ6s111q6sC38GZASIZCJ4GXgwrZAZA2ddo2V2EAinf0MwBM4AwVrTzWJ',
      }),
    });

    const event = buildTestEvent<SetFacebookUserAccessParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        facebookAccessInput: {
          facebook_accessToken:
            'EAACBw7i5ZAF0BABuIOa0BrLDOKvYSAB1lBCYW19r5NE3x95q49y80HTIgpgU4kN9lKnbuuC83VnmaPxOpIpGacf6xvm50G2VZC8VRxIClaA0l5aOD5eZB79S1MJ7lKkJ6s111q6sC38GZASIZCJ4GXgwrZAZA2ddo2V2EAinf0MwBM4AwVrTzWJ',
          facebook_userID: '10158973755827819',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('Facebook user access set.');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `https://graph.facebook.com/v15.0/oauth/access_token?grant_type=${FacebookGrantTypes.FB_EXCHANGE_TOKEN}&client_id=${process.env.FB_CLIENT_ID}&client_secret=${process.env.FB_SECRET_KEY}&fb_exchange_token=${event.arguments.facebookAccessInput.facebook_accessToken}`,
    );
  });
});
