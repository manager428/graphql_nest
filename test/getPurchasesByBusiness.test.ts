import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { handler } from '../lambda-handlers/get-purchases-by-business';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { GetPurchaseByBusinessParams } from '../lambda-handlers/get-purchases-by-business';
import { MarketingSources, PageView } from '@sirge-io/sirge-utils';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<PageView[] | null>>;

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
    const event = buildTestEvent<GetPurchaseByBusinessParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getPurchaseByBusinessInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
          date_from: '2022-06-04',
          date_to: '2022-12-04',
          source: MarketingSources.FACEBOOK,
          typePurchases: 'campaigns',
          selecte_ids: [2, 5, 24],
        },
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      PageView[]
    >;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();
    expect(message).toBeDefined();
    expect(message).toEqual('Purchases returned');
  });
});
