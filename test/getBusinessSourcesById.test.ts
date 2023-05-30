import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import {
  handler,
  GetBusinessSourcesParams,
} from '../lambda-handlers/get-business-sources-by-id';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { PageView } from '@sirge-io/sirge-utils';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<
    Result<{
      sources: PageView[];
      nextToken: string;
      numberPages: number;
    }>
  >;

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
    const event = buildTestEvent<GetBusinessSourcesParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getBusinessSourcesByIdInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
          date_from: '2022-02-07 16:30:22+00',
          date_to: '2023-03-07 16:30:22+00',
        },
      },
    });

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<{
      sources: PageView[];
      nextToken: string;
      numberPages: number;
    }>;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();
    expect(message).toBeDefined();
    expect(message).toEqual('Sources Returned.');
  });
});
