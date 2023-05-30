import { Callback, Context } from 'aws-lambda';
import { Result, SuccessResponse } from '../shared/types';
import {
  handler,
  UpdateStaffAccountAccessParams,
} from '../lambda-handlers/update-staff-account-access';
import AWS from 'aws-sdk';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { User } from '@sirge-io/sirge-utils';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<User[] | null>>;

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
    const event = buildTestEvent<UpdateStaffAccountAccessParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        updateStaffAccountAccessInput: {
          vanity_name: 'f1f1bb91-26e3-4ab6-84c6-a90c817606f9',
          staff_id: '6daadd85-784c-45d6-a724-87dcbe43930b',
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
    expect(message).toEqual('Staff account access updated successfully');
  });
});
