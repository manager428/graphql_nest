import { buildTestEvent } from './helpers/buildTestEvent';
import { AppSyncIdentityCognito, Callback, Context } from 'aws-lambda';
import { Result, SuccessResponse } from '../shared/types';
import {
  UpdateFacebookAdStatusParams,
  handler,
} from '../lambda-handlers/update-facebook-ad-status';
import { getTestContext } from './helpers/getTestContext';
import { FacebookAdStatuses } from '../shared/enums/facebookAdStatuses';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<boolean>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('successfully updates facebook ad status', async () => {
    const mock = jest.spyOn(global, 'fetch');

    mock.mockImplementation((url) => {
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: { success: true } }),
      } as unknown as Response);
    });

    const event = buildTestEvent<UpdateFacebookAdStatusParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        updateFacebookAdStatusInput: {
          status: FacebookAdStatuses.ACTIVE,
          adId: '123',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<boolean>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data).toBeTruthy();
    expect(message).toEqual('Facebook ad status updated');
  });
});
