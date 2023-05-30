import { User } from '@sirge-io/sirge-utils';
import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import { handler } from '../lambda-handlers/get-user-tik-tok-ads';
import {
  ConnectUserTikTokParams,
  Result,
  SuccessResponse,
  TiktokAds,
} from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

describe('test to get ads form tik tok api', () => {
  let context: Context;
  let callback: Callback<Result<TiktokAds[]>>;

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

  it('should pass token exchange', async () => {
    //@ts-ignore
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ something: 'random' }),
    });

    const event = buildTestEvent<ConnectUserTikTokParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        getTiktokAdAccountsInput: {
          tik_tok_access_token: 'aadf988009f2bbb5174a1798d09fd504f14621b1',
        },
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      TiktokAds[]
    >; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('Tik Tok Ads found.');
  });
});
