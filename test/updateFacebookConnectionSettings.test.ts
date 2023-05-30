import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  UpdateFacebookConnectionSettingsParams,
} from '../shared/types';
import { handler } from './../lambda-handlers/update-facebook-connection-settings';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<null>>;

  jest.setTimeout(20_000);

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

  it('verifies successful response', async () => {
    const event = buildTestEvent<UpdateFacebookConnectionSettingsParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        updateFacebookConnectionSettingsInput: {
          business_id: '91a9012c-e2aa-49e8-810f-4c69d92f5fba',
          fb_pixel_id: 377907384345199,
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<null>;

    const { message } = result;

    expect(message).toBeDefined();
    expect(message).toEqual('Facebook connection settings updated.');
  });
});
