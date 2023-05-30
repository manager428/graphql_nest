import { GetBusinessAdSetParams } from '../shared/types';
import AWS from 'aws-sdk';
import { Callback, Context } from 'aws-lambda';
import { handler } from '../lambda-handlers/get-business-ad-sets';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';
import { AdSet } from '@sirge-io/sirge-utils';
import { getFormatDate } from '../shared/time';
import { MarketingSources } from '@sirge-io/sirge-utils';
import { closeConnection } from '../shared/postgresDb';

require('dotenv').config();

jest.setTimeout(20_000);

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<AdSet[] | null>>;

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

  it('verifies successful tiktok response', async () => {
    // @ts-ignore - We only need ok and json()
    const mock = jest.spyOn(global, 'fetch');

    mock.mockImplementation((url) => {
      let response;

      switch (true) {
        case url.toString().includes('/adgroup/get'):
          response = {
            data: { list: [{ primary_status: 'ENABLE' }] },
          };
          break;
        case url.toString().includes('/reports/integrated/get'):
          response = {
            data: { list: [] },
          };
          break;
        default:
          response = {
            data: { list: [] },
          };
      }
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue(response),
      } as unknown as Response);
    });

    const event = buildTestEvent<GetBusinessAdSetParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        getBusinessAdSetInput: {
          business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
          date_from: getFormatDate(new Date(2022)),
          date_to: getFormatDate(new Date()),
          source: MarketingSources.TIKTOK,
          selected_campaigns: [6288836506060, 6288836506061],
        },
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      AdSet[]
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
      expect(message).toEqual('tiktok Ad sets retrieved successfully');
    }
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

    const event = buildTestEvent<GetBusinessAdSetParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        getBusinessAdSetInput: {
          business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
          date_from: getFormatDate(new Date(2022)),
          date_to: getFormatDate(new Date()),
          source: MarketingSources.FACEBOOK,
          selected_campaigns: [6288836506060, 6288836506061],
        },
      },
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      AdSet[]
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
      expect(message).toEqual('facebook Ad sets retrieved successfully');
    }
  });
});
