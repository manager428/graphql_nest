import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import { Result, SuccessResponse } from '../shared/types';
import {
  GetCreditTransactionParams,
  TransactionObjectResponse,
  handler,
} from './../lambda-handlers/get-credit-transactions';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<TransactionObjectResponse[]>>;

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
    const event = buildTestEvent<GetCreditTransactionParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      TransactionObjectResponse[]
    >; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    if (data) {
      expect(data[0].id).toBeDefined();
      expect(data[0].type).toBeDefined();
      expect(data[0].amount).toBeDefined();
      expect(data[0].created).toBeDefined();
      expect(data[0].ending_balance).toBeDefined();
    }

    expect(message).toBeDefined();
    expect(message).toEqual('Credit transactions fetched successfully.');
  });
});
