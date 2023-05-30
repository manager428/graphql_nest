import { BusinessParams, FacebookAdAccount } from './../shared/types.d';
import { Callback, Context } from 'aws-lambda';
import { handler } from '../lambda-handlers/get-facebook-ad-accounts';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

describe('test getting facebook campaign', () => {
  let context: Context;
  let callback: Callback<Result<FacebookAdAccount[]>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('should pass getting campaign', async () => {
    const event = buildTestEvent<BusinessParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        businessInput: {
          business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
        },
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      FacebookAdAccount[]
    >;

    const { message } = result;

    expect(message).toEqual('Facebook account returned successfully');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `https://graph.facebook.com/v15.0/10158973755827819/campaigns?fields=name&access_token=someRandomFakeTestAccessToken`,
    );
  });
});
