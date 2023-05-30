import { Business } from '@sirge-io/sirge-utils';
import { Callback } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  UpdateBusinessLogoInput,
} from '../shared/types';
import { handler } from './../lambda-handlers/update-business-logo';
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
    const event = buildTestEvent<UpdateBusinessLogoInput>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        updateBusinessLogoInput: {
          business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
          file_url: 'https://via.placeholder.com/200',
        },
      },
    });

    const context = getTestContext();

    const callback: Callback<Result<Business>> = () => {};

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<Business>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.logo).toBeDefined();
    expect(data?.logo).toEqual(
      event.arguments.updateBusinessLogoInput.file_url,
    );
    expect(message).toEqual('Business logo updated successfully');
  });
});
