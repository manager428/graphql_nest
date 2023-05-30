import { buildTestEvent } from './helpers/buildTestEvent';
import { AppSyncIdentityCognito, Callback, Context } from 'aws-lambda';
import { Result, SuccessResponse } from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import { GetUserParams, handler } from '../lambda-handlers/get-user';
import AWS from 'aws-sdk';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
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

  it('verifies successful manager response', async () => {
    const event = buildTestEvent<GetUserParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<User>; // Expecting a response, so AS it

    const { data } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.user_id).toEqual(
      (event.identity as AppSyncIdentityCognito).sub,
    );
    expect(data?.email).not.toBeNull();
  });

  it('verifies successful staff response', async () => {
    const event = buildTestEvent<GetUserParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {},
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<User>; // Expecting a response, so AS it

    const { data } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.user_id).toEqual(
      (event.identity as AppSyncIdentityCognito).sub,
    );
    expect(data?.email).not.toBeNull();
  });
});
