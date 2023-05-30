import { AppSyncResolverEvent, Callback, Context } from 'aws-lambda';
import {
  Result,
  DeleteStaffAccountParams,
  SuccessResponse,
} from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import { handler } from '../lambda-handlers/delete-staff-account';
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

  it('verifies deletion of staff account', async () => {
    // TODO: Create a user for each run
    const staffId = '58968554-8bd6-4c00-bf28-d18d1c713caa';

    const event = buildTestEvent<DeleteStaffAccountParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        deleteStaffAccountInput: {
          staff_id: staffId,
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<User>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.user_id).toEqual(
      event.arguments.deleteStaffAccountInput.staff_id,
    );
    expect(data?.email).not.toBeNull();

    expect(message).toEqual('Staff account deleted successfully');
  });
});
