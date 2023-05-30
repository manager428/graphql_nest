import { Callback, Context } from 'aws-lambda';
import { FacebookGrantTypes } from '../shared/facebook';
import {
  handler,
  RemoveFacebookUserAccessParams,
} from '../lambda-handlers/remove-facebook-user-access';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { User } from '@sirge-io/sirge-utils';

describe('test removing facebook account access', () => {
  let context: Context;
  let callback: Callback<Result<User | null>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('should remove facebook user access', async () => {
    const event = buildTestEvent<RemoveFacebookUserAccessParams>({
      userId: 'dbbf6b33-64aa-45f5-bb6f-da449b50f287',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toEqual('Facebook user access removed.');
  });
});
