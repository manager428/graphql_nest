import { GetUserSessionParams } from './../shared/types.d';
import { Callback, Context } from 'aws-lambda';
import { Result, SuccessResponse, UserSession } from '../shared/types';
import { handler } from './../lambda-handlers/get-current-user-sessions';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<UserSession[]>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('verifies successful response', async () => {
    const event = buildTestEvent<GetUserSessionParams>({
      userId: '00a4749e-f0f8-4c17-9da7-38a153128dd4',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      UserSession[]
    >; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    if (data?.length) {
      expect(data[0].ip).toBeDefined();
      expect(data[0].browser_name).toBeDefined();
      expect(data[0].browser_version).toBeDefined();
    }

    expect(message).toBeDefined();
    expect(message).toEqual('Successfully fetched sessions');
  });
});
