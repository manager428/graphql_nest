import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { Result, UploadLogoParams, SuccessResponse } from '../shared/types';
import {
  handler,
  PresignedUploadUrlResponse,
} from '../lambda-handlers/generate-upload-url';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<PresignedUploadUrlResponse | null>>;

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
    const event = buildTestEvent<UploadLogoParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        generateUploadUrlInput: {
          business_id: '62cf19a5-6e44-42e4-82cf-da139f3e61c1',
          extension_type: 'png',
          content_type: 'image/png',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<PresignedUploadUrlResponse>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toEqual('Presigned URL successfully created');
  });
});
