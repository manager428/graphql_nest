import { Callback, Context } from 'aws-lambda';
import {
  Result,
  EventLogUsage,
  SuccessResponse,
  GetEventLogUsageLastThreeMonthsParams,
} from '../shared/types';
import { getTestContext } from './helpers/getTestContext';
import { buildTestEvent } from './helpers/buildTestEvent';
import { handler } from '../lambda-handlers/get-usage-last-three-months';
import AWS from 'aws-sdk';
import { getFormatDate } from '../shared/time';

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

  it('verifies successful manager response', async () => {
    const event = buildTestEvent<GetEventLogUsageLastThreeMonthsParams>({
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

    const date = new Date();

    expect(data?.[0].labels[0]).toEqual(
      getFormatDate(new Date(date.getFullYear(), date.getMonth()), {
        month: 'long',
      }),
    );
    expect(data?.[0].labels[1]).toEqual(
      getFormatDate(new Date(date.getFullYear(), date.getMonth() - 2), {
        month: 'long',
      }),
    );
    expect(data?.[0].labels[2]).toEqual(
      getFormatDate(new Date(date.getFullYear(), date.getMonth() - 3), {
        month: 'long',
      }),
    );

    expect(message).toEqual(
      'Successfully pulled last three months of event logs.',
    );
  });
});
