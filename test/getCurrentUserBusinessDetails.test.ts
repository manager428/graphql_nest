import { Callback } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  getCurrentUserBusinessParams,
  CurrentUserBusinessDetails,
} from '../shared/types';
import { handler } from './../lambda-handlers/get-current-user-business-details';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

jest.setTimeout(20_000);

describe('Verifies user business details response', () => {
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
    const event = buildTestEvent<getCurrentUserBusinessParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getCurrentUserBusinessDetailsInput: {
          vanity_name: 'testingbusiness3',
        },
      },
    });

    const context = getTestContext();

    const callback: Callback<Result<CurrentUserBusinessDetails>> = () => {};

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<CurrentUserBusinessDetails>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(message).toEqual('Details successfully fetched');
  });
});
