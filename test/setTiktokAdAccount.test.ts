import { Callback, Context } from 'aws-lambda';
import {
  handler,
  SetTiktokAdAccountParams,
} from '../lambda-handlers/set-tiktok-ad-account';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

describe('test setting tiktok account', () => {
  let context: Context;
  let callback: Callback<Result<null>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('should set tik tok ad account', async () => {
    const event = buildTestEvent<SetTiktokAdAccountParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        setTiktokAdAccountInput: {
          business_id: 'ef6a00fd-49f0-47b2-a83a-922d9ef43c7d',
          tik_tok_ad_account_id: '6921429370846314497',
          tik_tok_ad_account_name: 'Chappell Digital0124',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('Tik tok account set');
  });
});
