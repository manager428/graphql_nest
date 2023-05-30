import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import { Result, SuccessResponse } from '../shared/types';
import { PlatformSettings } from '@sirge-io/sirge-utils';

import {
  GetPlatformSettingsParams,
  handler,
} from './../lambda-handlers/get-platform-mode';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
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
    const event = buildTestEvent<GetPlatformSettingsParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {},
    });

    const context = getTestContext();

    const callback: Callback<Result<PlatformSettings>> = () => {};

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<PlatformSettings>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.maintenance_mode).toBeDefined();
    expect(data?.closed_mode).toBeDefined();
    expect(data?.free_trial_page_view_limit).toBeDefined();

    expect(message).toEqual('Platform settings fetched successfully');
  });
});
