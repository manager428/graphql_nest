import { buildTestEvent } from './helpers/buildTestEvent';
import { Callback, Context } from 'aws-lambda';
import { GetStaffByIdParams, Result, SuccessResponse } from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import { handler } from '../lambda-handlers/get-staff-byId';
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
    const event = buildTestEvent<GetStaffByIdParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        getStaffByIdInput: {
          staff_id: '8b9c9657-9d69-496e-9c6c-18357c0edad1',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<User>; // Expecting a response, so AS it

    const { data } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.email).not.toBeNull();
  });
});
