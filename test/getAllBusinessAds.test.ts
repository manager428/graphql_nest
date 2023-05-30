import { GetBusinessAdsParams } from '../shared/types';
import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { handler } from '../lambda-handlers/get-all-business-ads';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { AdsFacebook } from '../shared/types';
import { getFormatDate } from '../shared/time';
import { MarketingSources } from '@sirge-io/sirge-utils';
import { closeConnection } from '../shared/postgresDb';

require('dotenv').config();

jest.setTimeout(20_000);

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<AdsFacebook[] | null>>;

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

  afterAll(async () => {
    await closeConnection(); // Close postgres connection so tests do not hang
  });

  it('verifies successful facebook response', async () => {
    const mock = jest.spyOn(global, 'fetch');

    mock.mockImplementation((url) => {
      let response;

      switch (true) {
        case url.toString().includes('effective_status'):
          response = {
            data: { effective_status: 'ACTIVE', account_id: '1234' },
          };
          break;
        case url.toString().includes('/insights'):
          response = {
            data: [{ spend: 1000 }],
          };
          break;
        default:
          response = {
            data: {},
          };
      }
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue(response),
      } as unknown as Response);
    });

    const event = buildTestEvent<GetBusinessAdsParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Managers',
      requestPayload: {
        business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
        date_from: '2021-01-24 06:00:00.000Z',
        date_to: '2023-02-01 06:00:00.000Z',
        source: MarketingSources.FACEBOOK,
        // selected_campaigns: ['6288836506060', '6288836506061'],
        // selected_ad_sets: '',
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      AdsFacebook[]
    >;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    if (!data?.length) {
      expect(message).toEqual(
        'Successfully pulled ad sets. No ad sets returned',
      );
    } else {
      expect(data?.length).toBeGreaterThan(0);
      expect(data[data.length - 1].total_title).toBeDefined();
      expect(message).toEqual('Facebook Ads for business fetched successfully');
    }
  });
});
