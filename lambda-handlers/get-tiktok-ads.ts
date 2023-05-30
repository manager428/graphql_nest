import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  findExchangeRateBySourceToCurrency,
  getBusiness,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { getPageViewsByGroup } from '../shared/postgresDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import * as utils from '../shared/utils';
import { StatusCodeError } from '../shared/statusCodes';
import { Result, TikTokAdParams } from '../shared/types';
import { TikTokAdSet } from '@sirge-io/sirge-utils';
import { AdSet, ExchangeRate } from '@sirge-io/sirge-utils';
import { validatePayloadRequiredKeys } from '../shared/validatePayloadRequiredKeys';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getTiktokAd, getTiktokInsights } from '../shared/tiktok';
import * as Sentry from '@sentry/serverless';

Sentry.AWSLambda.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  attachStacktrace: true,
  normalizeDepth: 10,
  serverName: process.env.AWS_LAMBDA_FUNCTION_NAME,
  initialScope: {
    tags: {
      region: process.env.AWS_DEFAULT_REGION,
      runtimer: process.env.AWS_EXECUTION_ENV,
      name: 'get-tiktok-ads',
    },
  },
});

export const handler: AppSyncResolverHandler<
  TikTokAdParams,
  Result<TikTokAdSet[]>
> = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );
    utils.logInfo(context, 'Context');

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    const {
      business_id,
      date_from,
      date_to,
      source,
      exchange_rate_date,
      selected_campaigns,
      selected_ad_sets,
    } = event.arguments.TikTokAdInput;

    if (!user) {
      throw new StatusCodeError(185);
    }
    if (!user.tik_tok_access_token) {
      throw new StatusCodeError(186);
    }

    validatePayloadRequiredKeys(
      [
        'business_id',
        'date_from',
        'date_to',
        'exchange_rate_date',
        'source',
        'selected_campaigns',
        'selected_ad_sets',
      ],
      event.arguments.TikTokAdInput,
    );

    const business = await getBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(1);
    }
    if (!business.tik_tok_ad_account_id) {
      throw new StatusCodeError(187);
    }

    if (!source.includes('Tiktok')) {
      throw new StatusCodeError(192);
    }

    const headers = {
      'Access-Token': user.tik_tok_access_token,
    };

    let account_currency = user.currency;
    let convert_currency = false;
    let convert_two_currency = false;
    let base_exchange_rate: number = 0;
    let account_exchange_rate: number = 0;

    const tik_tok_ad_account_currency = business.tik_tok_ad_account_currency;

    if (!(account_currency === tik_tok_ad_account_currency)) {
      convert_currency = true;

      if (tik_tok_ad_account_currency == 'USD') {
        const rate: ExchangeRate = await findExchangeRateBySourceToCurrency(
          account_currency as string,
          exchange_rate_date,
        );

        account_exchange_rate = rate.rate;
        convert_two_currency = false;
      } else {
        const rate1: ExchangeRate = await findExchangeRateBySourceToCurrency(
          tik_tok_ad_account_currency as string,
          exchange_rate_date,
        );

        base_exchange_rate = rate1.rate;

        const rate2: ExchangeRate = await findExchangeRateBySourceToCurrency(
          account_currency as string,
          exchange_rate_date,
        );

        account_exchange_rate = rate2.rate;
        convert_two_currency = true;
      }
    }

    const tik_tok_date_from = Intl.DateTimeFormat('zh', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date_from);
    const tik_tok_date_to = Intl.DateTimeFormat('zh', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date_to);

    let selectedValues: {
      isSelectedCampaign: boolean;
      array: string[] | number[];
    } = {
      isSelectedCampaign: false,
      array: [],
    };

    if (selected_campaigns.length > 0) {
      selectedValues = { isSelectedCampaign: true, array: selected_campaigns };
    } else if (selected_ad_sets.length > 0) {
      selectedValues = { isSelectedCampaign: false, array: selected_ad_sets };
    } else {
      selectedValues = { array: [], isSelectedCampaign: false };
    }

    const all_ads: AdSet[] = (await getPageViewsByGroup(
      business_id,
      source.join("','"),
      selectedValues,
      date_from,
      date_to,
      true,
    )) as AdSet[];

    if (all_ads.length === 0) {
      throw new StatusCodeError(190);
    }

    let ads_array: TikTokAdSet[] = [];

    let rows: number = 0;

    let total_source_amount_spent: number = 0;
    let total_source_clicks: number = 0;
    let total_source_purchases: number = 0;
    let total_source_conversion_value: number = 0;
    let total_sirge_clicks: number = 0;
    let total_sirge_purchases: number = 0;
    let total_sirge_total_conversion_value: number = 0;

    const ad_ids = all_ads
      .map((item) => String(item.sirge_ad_id))
      .filter((item) => item !== '__cid__');

    const effective_status_arr_batch = await getTiktokAd(
      user.tik_tok_access_token,
      business.tik_tok_ad_account_id,
      ad_ids,
    );

    let insights = await getTiktokInsights(
      user.tik_tok_access_token as string,
      business.tik_tok_ad_account_id as string,
      tik_tok_date_from,
      tik_tok_date_to,
      ad_ids,
      'ad_ids',
    );

    const effective_status_arr = effective_status_arr_batch?.list || [];
    const insights_arr = insights?.list || [];

    const all_data = all_ads.map((ad: AdSet) => {
      rows = rows + 1;

      let sirge_purchases: number = ad.purchases_count;
      let sirge_clicks: number = ad.clicks_count;
      let sirge_conversion_value: number = ad.conversion_value;

      let source_delivery_status: string = '';
      let source_data_amount_spent: number = 0;
      let source_data_clicks: number = 0;
      let source_data_purchases: number = 0;
      let source_data_cost_per_purchase: number = 0;
      let source_data_conversion_value: number = 0;
      let source_data_roas: string = '';

      let create_object: boolean = false;

      let skip_to_object_creation: boolean = false;

      if (ad.sirge_ad_id?.indexOf('__cid__') === 0) {
        skip_to_object_creation = true;
        rows = rows - 1;
      }

      if (!skip_to_object_creation) {
        create_object = true;

        const effective_status = effective_status_arr.find(
          (item: { ad_id: string }) => item.ad_id == ad.sirge_ad_id,
        );

        if (!effective_status) {
          create_object = false;
        } else {
          create_object = true;
          source_delivery_status =
            effective_status.primary_status == 'ENABLE' ? 'Active' : 'Disabled';

          const insights = insights_arr.find(
            (item: { dimensions: { ad_id: string } }) =>
              item?.dimensions?.ad_id == ad?.sirge_ad_id,
          );

          if (!insights) {
            //tiktok has no data for this. null all
          } else {
            let insight_data = insights.metrics;
            if (convert_currency) {
              if (convert_two_currency) {
                const conversion_value_conversion1 = Math.round(
                  (insight_data.total_compconste_payment_rate *
                    base_exchange_rate *
                    100) /
                    100,
                );
                const conversion_value_conversion2 = Math.round(
                  (conversion_value_conversion1 * account_exchange_rate * 100) /
                    100,
                );
                source_data_conversion_value = conversion_value_conversion2;

                const spend_value_conversion1 = Math.round(
                  (insight_data.spend * base_exchange_rate * 100) / 100,
                );
                const spend_value_conversion2 = Math.round(
                  (spend_value_conversion1 * account_exchange_rate * 100) / 100,
                );
                source_data_amount_spent = spend_value_conversion2;

                const cost_per_purchase_value_conversion1 = Math.round(
                  (insight_data.cost_per_conversion *
                    base_exchange_rate *
                    100) /
                    100,
                );
                const cost_per_purchase_value_conversion2 = Math.round(
                  (cost_per_purchase_value_conversion1 *
                    account_exchange_rate *
                    100) /
                    100,
                );
                source_data_cost_per_purchase =
                  cost_per_purchase_value_conversion2;
              } else {
                const conversion_value_conversion1 = Math.round(
                  (insight_data.total_compconste_payment_rate *
                    account_exchange_rate *
                    100) /
                    100,
                );
                source_data_conversion_value = conversion_value_conversion1;

                const spend_value_conversion1 = Math.round(
                  (insight_data.spend * account_exchange_rate * 100) / 100,
                );
                source_data_amount_spent = spend_value_conversion1;

                const cost_per_purchase_value_conversion1 = Math.round(
                  (insight_data.cost_per_conversion *
                    account_exchange_rate *
                    100) /
                    100,
                );
                source_data_cost_per_purchase =
                  cost_per_purchase_value_conversion1;
              }
            } else {
              source_data_conversion_value = Math.round(
                insight_data.total_complete_payment_rate,
              );
              source_data_amount_spent = Math.round(insight_data.spend);
              source_data_cost_per_purchase = Math.round(
                insight_data.cost_per_conversion,
              );
            }
            source_data_clicks = Number(insight_data.clicks);
            source_data_purchases = Number(insight_data.conversion);
            source_data_roas = `${Math.round(
              insight_data.complete_payment_roas,
            )}x`;
          }
        }
      }

      let ad_name = ad.ad;

      if (create_object) {
        let sirge_cost_per_purchase = source_data_amount_spent
          ? sirge_purchases
            ? Math.round(source_data_amount_spent / sirge_purchases)
            : null
          : null;

        total_source_amount_spent =
          total_source_amount_spent + source_data_amount_spent;

        total_source_clicks = source_data_clicks
          ? total_source_clicks + source_data_clicks
          : total_source_clicks;

        total_source_purchases = source_data_purchases
          ? total_source_purchases + source_data_purchases
          : total_source_purchases;

        total_source_conversion_value = source_data_conversion_value
          ? total_source_conversion_value + source_data_conversion_value
          : total_source_conversion_value;

        total_sirge_clicks = sirge_clicks
          ? total_sirge_clicks + sirge_clicks
          : total_sirge_clicks;

        total_sirge_purchases = sirge_purchases
          ? total_sirge_purchases + sirge_purchases
          : total_sirge_purchases;

        total_sirge_total_conversion_value = sirge_conversion_value
          ? total_sirge_total_conversion_value + sirge_conversion_value
          : total_sirge_total_conversion_value;

        let object: TikTokAdSet = {
          id: rows,
          source_delivery_status: source_delivery_status,
          sirge_ad_id: ad.sirge_ad_id,
          ad_name: ad_name,
          amount_spent: source_data_amount_spent,
          clicks: source_data_clicks ? source_data_clicks : 0,
          purchases: source_data_purchases ? source_data_purchases : 0,
          cost_per_purchase: source_data_cost_per_purchase
            ? source_data_cost_per_purchase
            : 0,
          total_conversion_value: source_data_conversion_value
            ? source_data_conversion_value
            : 0,
          roas: source_data_roas ? source_data_roas : '',
          sirge_clicks: sirge_clicks ? sirge_clicks : 0,
          sirge_purchases: sirge_purchases ? sirge_purchases : 0,
          sirge_cost_per_purchase: sirge_cost_per_purchase,
          sirge_total_conversion_value: sirge_conversion_value
            ? sirge_conversion_value
            : 0,
          sirge_roas: source_data_amount_spent
            ? sirge_conversion_value
              ? `${sirge_conversion_value / source_data_amount_spent}x`
              : null
            : null,
        };

        ads_array.push(object);

        return ads_array;
      }
    });

    if (all_data) {
      let total_title_name = rows == 1 ? 'ad' : 'ads';

      let total_object: TikTokAdSet = {
        id: rows + 1,
        total_title: `Results from ${rows} ${total_title_name}`,
        amount_spent: total_source_amount_spent,
        clicks: total_source_clicks ? total_source_clicks : 0,
        purchases: total_source_purchases ? total_source_purchases : 0,
        cost_per_purchase: total_source_amount_spent
          ? total_source_purchases
            ? Math.round(total_source_amount_spent / total_source_purchases)
            : 0
          : 0,
        total_conversion_value: total_source_conversion_value
          ? total_source_conversion_value
          : 0,
        roas: total_source_amount_spent
          ? total_source_conversion_value
            ? `${Math.round(
                total_source_conversion_value / total_source_amount_spent,
              )}x`
            : ''
          : '',
        sirge_clicks: total_sirge_clicks ? total_sirge_clicks : 0,
        sirge_purchases: total_sirge_purchases ? total_sirge_purchases : 0,
        sirge_cost_per_purchase: total_source_amount_spent
          ? total_sirge_purchases
            ? Math.round(total_source_amount_spent / total_sirge_purchases)
            : 0
          : 0,
        sirge_total_conversion_value: total_sirge_total_conversion_value
          ? total_sirge_total_conversion_value
          : 0,
        sirge_roas: total_source_amount_spent
          ? total_sirge_total_conversion_value
            ? `${
                total_sirge_total_conversion_value / total_source_amount_spent
              }x`
            : null
          : null,
      };

      ads_array.push(total_object);

      return ads_array;
    }

    return successResponse(ads_array, 'Ad retrieved successfully') as any;
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<TikTokAdParams, Result<TikTokAdSet[]>>(
    handler,
    buildTestEvent<TikTokAdParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        TikTokAdInput: {
          business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
          date_from: new Date(),
          date_to: new Date(),
          exchange_rate_date: new Date(),
          source: ['Tiktok'],
          selected_campaigns: [23852347232940424],
          selected_ad_sets: [6288836506460],
        },
      },
    }),
  );
}
