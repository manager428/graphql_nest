import { User } from '@sirge-io/sirge-utils';
import { AppSyncIdentityCognito, Callback } from 'aws-lambda';
import AWS from 'aws-sdk';
import { Result, SuccessResponse, UpdateUserParams } from '../shared/types';
import { handler } from './../lambda-handlers/update-user';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

jest.setTimeout(20_000);

describe('Verifies user updated response', () => {
  beforeAll(() => {
    if (process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
      AWS.config.update({
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
        region: 'us-west-2',
      });
    }
  });

  it('verifies successful response', async () => {
    const event = buildTestEvent<UpdateUserParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        updateUserInput: {
          first_name: 'someTestUser1',
          last_name: 'someTestUser',
          full_address: '3701 Alness Street',
          postal_code: '95014',
          country_name: 'US',
          country_code: 'US',
        },
      },
    });

    const context = getTestContext();

    const callback: Callback<Result<User | null>> = () => {};

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<User>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.user_id).toEqual(
      (event.identity as AppSyncIdentityCognito).sub,
    );

    expect(message).toEqual('User updated successfully');
  });
});
