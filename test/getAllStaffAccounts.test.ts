import { AppSyncResolverEvent, Callback, Context } from 'aws-lambda';
import { Result, SuccessResponse } from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import {
  handler,
  GetStaffAccountsParams,
} from '../lambda-handlers/get-all-staff-accounts';
import AWS from 'aws-sdk';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

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
    const event = buildTestEvent<GetStaffAccountsParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      User[]
    >; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(message).toEqual('Fetched staff accounts successfully');
  });
});
