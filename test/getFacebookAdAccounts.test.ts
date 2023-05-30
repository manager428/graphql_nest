import { FacebookAdAccount } from './../shared/types.d';
import { Callback, Context } from 'aws-lambda';
import {
  GetFacebookAdAccountsParams,
  handler,
} from '../lambda-handlers/get-facebook-ad-accounts';
import { FacebookGrantTypes } from '../shared/facebook';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

describe('test getting facebook ad accounts', () => {
  let context: Context;
  let callback: Callback<Result<FacebookAdAccount[]>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('should pass getting ad accounts', async () => {
    // @ts-ignore - We only need ok and json()
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          id: 'some ad account ID',
          currency: 'USD',
        },
      ]),
    });

    const event = buildTestEvent<GetFacebookAdAccountsParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      FacebookAdAccount[]
    >; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('Facebook ad accounts fetched successfully');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `https://graph.facebook.com/v15.0/10158973755827819/adaccounts?limit=10000000&fields=name,currency&access_token=someRandomFakeTestAccessToken`,
    );
  });
});
