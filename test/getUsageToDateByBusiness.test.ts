import { Callback, Context } from 'aws-lambda';
import {
  Result,
  EventLogUsage,
  SuccessResponse,
  GetEventLogUsageToDateByBusinessParams,
} from '../shared/types';
import { getTestContext } from './helpers/getTestContext';
import { buildTestEvent } from './helpers/buildTestEvent';
import { handler } from '../lambda-handlers/get-usage-to-date-by-business';
import AWS from 'aws-sdk';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<EventLogUsage[]>>;

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

  it('verifies successful event log to date response', async () => {
    const event = buildTestEvent<GetEventLogUsageToDateByBusinessParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      EventLogUsage[]
    >; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.[0].labels).toBeDefined();
    expect(data?.[0].values).toBeDefined();

    expect(message).toEqual('Successfully pulled event logs to date.');
  });
});
