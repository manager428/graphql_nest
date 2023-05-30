import { Callback, Context } from 'aws-lambda';
import {
  CreateStaffAccountParams,
  Result,
  SuccessResponse,
} from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import { handler } from '../lambda-handlers/create-staff-account';
import AWS from 'aws-sdk';
import { buildTestEvent } from './helpers/buildTestEvent';
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

  it('verifies successful staff account response', async () => {
    const event = buildTestEvent<CreateStaffAccountParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        createStaffAccountInput: {
          first_name: 'first_name',
          last_name: 'last_name',
          email: `testemail${new Date().getTime()}@teststaff.com`,
          password: 'TestPassword@1234',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>; // Expecting a response, so AS it

    const { message } = result;

    expect(message).toBeDefined();
    expect(message).toEqual('Staff account created successfully');
  });
});
