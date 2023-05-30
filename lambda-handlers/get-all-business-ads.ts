import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusiness,
  getExchangesRates,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { AdsFacebook, Result, GetBusinessAdsParams } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { getInfoCampaignsFacebook, logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
import {
  Business,
  BusinessStatus,
  SubscriptionStatuses,
  User,
} from '@sirge-io/sirge-utils';
import { getFacebookAds, getFacebookAdsReports } from '../shared/facebook';
import { endOfDay, getFormatDate, startOfDay } from '../shared/time';
import { getPageViewsAds } from '../shared/postgresDb';
import { FacebookSourceKeys } from '../shared/enums/facebookSources';
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
      name: 'get-all-business-ads',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetBusinessAdsParams,
  Result<AdsFacebook[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const {
      business_id,
      date_from = new Date(),
      date_to = new Date(),
      source,
      selected_campaigns,
      selected_ad_sets,
    } = event?.arguments;

    if (source !== 'facebook') {
      throw new StatusCodeError(63);
    }

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser, managingUser, isManager } =
      await verifyUserSubscription(auth);

    const user: User | undefined = isManager ? authenticatedUser : managingUser;

    if (!user) {
      throw new StatusCodeError(185);
    }

    let facebookAccessToken: string = '',
      facebookAdAccountId: string = '';

    if (user?.subscription?.status === SubscriptionStatuses.CANCELLED) {
      throw new StatusCodeError(88);
    }

    if (source === 'facebook') {
      if (!user?.facebook_accessToken) {
        throw new StatusCodeError(59);
      } else {
        facebookAccessToken = user?.facebook_accessToken;
      }
    }

    const business: Business = await getBusiness(business_id);

    if (business?.status !== BusinessStatus.ACTIVE) {
      throw new StatusCodeError(0);
    }

    if (!business?.facebook_ad_account_id) {
      throw new StatusCodeError(59);
    }

    let dateFrom = startOfDay(date_from as string, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    let dateTo = startOfDay(date_to as string, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    let date_from_fb = getFormatDate(date_from as string, {
      dateStyle: 'short',
    });

    let date_to_fb = getFormatDate(date_to as string, {
      dateStyle: 'short',
    });

    const {
      convert_currency,
      convert_two_currency,
      base_exchange_rate,
      account_exchange_rate,
    } = await getExchangesRates(user, business, true);

    if (selected_campaigns && selected_campaigns.includes('')) {
      throw new StatusCodeError(120);
    }

    if (selected_ad_sets && selected_ad_sets.includes('')) {
      throw new StatusCodeError(128);
    }

    const isTypeOfSelectedArray: string | null = selected_campaigns
      ? 'selected_campaigns'
      : selected_ad_sets
      ? 'selected_ad_sets'
      : null;

    const selected_array: string[] | undefined =
      isTypeOfSelectedArray === 'selected_campaigns'
        ? selected_campaigns
        : selected_ad_sets;

    const all_ads = await getPageViewsAds(
      business_id,
      Object.keys(FacebookSourceKeys)
        .filter((v) => isNaN(parseFloat(v)))
        .join("','"),
      dateFrom,
      dateTo,
      isTypeOfSelectedArray,
      selected_array,
    );

    if (!all_ads?.length) {
      return successResponse([], 'Successfully pulled ad. No ad returned');
    }

    const ads_array: AdsFacebook[] = [];

    let total_source_amount_spent = 0;
    let total_source_clicks = 0;
    let total_source_purchases = 0;
    let total_source_conversion_value = 0;
    let total_sirge_clicks = 0;
    let total_sirge_purchases = 0;
    let total_sirge_total_conversion_value = 0;
    let facebookAdsData: any | null = null;

    const promises = all_ads.map(async (ad, index) => {
      index += 1;

      let sirge_purchases = ad?.purchases_count;
      let sirge_clicks = ad?.clicks_count;
      let sirge_conversion_value = ad?.conversion_value;

      let source_delivery_status = null;
      let facebook_ad_data = null;
      let create_object: boolean = false;
      let skip_to_object_creation: boolean = false;

      if (ad?.sirge_ad_id.indexOf('ad.id') !== -1) {
        skip_to_object_creation = true;
        index -= 1;
      }

      if (!skip_to_object_creation) {
        if (source === 'facebook') {
          const data = await getFacebookAds(
            ad?.sirge_ad_id,
            facebookAccessToken,
          );

          if (data?.error) {
            if (data?.error?.type === 'OAuthException') {
              throw new StatusCodeError(59);
            } else {
              create_object = true;
            }
          } else {
            if (!data?.account_id) {
              create_object = false;
            } else {
              if (`act_${data?.account_id}` !== facebookAdAccountId) {
                create_object = false;
              } else {
                create_object = true;

                if (data?.effective_status) {
                  const effectiveStatusArr = data.effective_status.split('_');
                  if (effectiveStatusArr.length > 1) {
                    source_delivery_status =
                      effectiveStatusArr[0] === 'ACTIVE'
                        ? 'Active'
                        : `${effectiveStatusArr[0]} ${effectiveStatusArr[1]}`.toLowerCase();
                  } else {
                    source_delivery_status =
                      effectiveStatusArr[0] === 'ACTIVE'
                        ? 'Active'
                        : effectiveStatusArr[0].toLowerCase();
                  }
                } else {
                  source_delivery_status = null;
                }

                const insightData = await getFacebookAdsReports(
                  facebookAdAccountId,
                  date_from_fb,
                  date_to_fb,
                  facebookAccessToken,
                );
                if (insightData.error) {
                  if (data.error.type === 'OAuthException') {
                    throw new StatusCodeError(59);
                  }
                } else {
                  facebook_ad_data = insightData?.data[0];

                  const isAd: boolean = true;

                  facebookAdsData = getInfoCampaignsFacebook(
                    insightData?.data,
                    convert_currency,
                    convert_two_currency,
                    base_exchange_rate,
                    account_exchange_rate,
                    isAd,
                  );
                }
              }
            }
          }
        }
      }

      const {
        source_data_conversion_value,
        source_data_amount_spent,
        source_data_cost_per_purchase,
        source_data_clicks,
        source_data_purchases,
        source_data_roas,
      } = facebookAdsData;

      if (create_object) {
        const sirge_cost_per_purchase =
          source_data_amount_spent && sirge_purchases
            ? Math.round(source_data_amount_spent / sirge_purchases)
            : null;
        total_source_amount_spent += source_data_amount_spent;
        total_source_clicks = source_data_clicks
          ? total_source_clicks + source_data_clicks
          : total_source_clicks + 0;
        total_source_purchases = source_data_purchases
          ? total_source_purchases + source_data_purchases
          : total_source_purchases + 0;
        total_source_conversion_value = source_data_conversion_value
          ? total_source_conversion_value + source_data_conversion_value
          : total_source_conversion_value + 0;
        total_sirge_clicks = sirge_clicks
          ? total_sirge_clicks + sirge_clicks
          : total_sirge_clicks + 0;
        total_sirge_purchases = sirge_purchases
          ? total_sirge_purchases + sirge_purchases
          : total_sirge_purchases + 0;
        total_sirge_total_conversion_value = sirge_conversion_value
          ? total_sirge_total_conversion_value + sirge_conversion_value
          : total_sirge_total_conversion_value + 0;

        const object: AdsFacebook = {
          id: index,
          source_delivery_status: source_delivery_status,
          sirge_ad_id: ad.sirge_ad_id,
          ad_name: ad,
          amount_spent: source_data_amount_spent,
          clicks: source_data_clicks ? source_data_clicks : null,
          purchases: source_data_purchases ? source_data_purchases : null,
          cost_per_purchase: source_data_cost_per_purchase
            ? source_data_cost_per_purchase
            : null,
          total_conversion_value: source_data_conversion_value
            ? source_data_conversion_value
            : null,
          roas: source_data_roas ? source_data_roas : null,
          sirge_clicks: sirge_clicks ? sirge_clicks : null,
          sirge_purchases: sirge_purchases ? sirge_purchases : null,
          sirge_cost_per_purchase: sirge_cost_per_purchase,
          sirge_total_conversion_value: sirge_conversion_value
            ? sirge_conversion_value
            : null,
          sirge_roas: source_data_amount_spent
            ? sirge_conversion_value
              ? `${(sirge_conversion_value / source_data_amount_spent).toFixed(
                  2,
                )}x`
              : null
            : null,
        };

        ads_array.push(object);
      }
    });

    const all_data = await Promise.all(promises);

    if (all_data?.length > 0) {
      const total_title_name = ads_array.length === 1 ? 'ad' : 'ads';

      const totalObject: AdsFacebook = {
        id: ads_array.length + 1,
        total_title: `Results from ${ads_array.length} ${total_title_name}`,
        amount_spent: total_source_amount_spent,
        clicks: total_source_clicks || null,
        purchases: total_source_purchases || null,
        cost_per_purchase: total_source_amount_spent
          ? total_source_purchases
            ? Math.round(total_source_amount_spent / total_source_purchases)
            : null
          : null,
        total_conversion_value: total_source_conversion_value || null,
        roas: total_source_amount_spent
          ? total_source_conversion_value
            ? `${Math.round(
                total_source_conversion_value / total_source_amount_spent,
              ).toFixed(2)}x`
            : null
          : null,
        sirge_clicks: total_sirge_clicks || null,
        sirge_purchases: total_sirge_purchases || null,
        sirge_cost_per_purchase: total_source_amount_spent
          ? total_sirge_purchases
            ? Math.round(total_source_amount_spent / total_sirge_purchases)
            : null
          : null,
        sirge_total_conversion_value:
          total_sirge_total_conversion_value || null,
        sirge_roas: total_source_amount_spent
          ? total_sirge_total_conversion_value
            ? `${Math.round(
                total_sirge_total_conversion_value / total_source_amount_spent,
              ).toFixed(2)}x`
            : null
          : null,
      };

      ads_array.push(totalObject);
    }

    return successResponse(
      ads_array,
      'Facebook Ads for business fetched successfully',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetBusinessAdsParams, Result<AdsFacebook[]>>(
    handler,
    buildTestEvent<GetBusinessAdsParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Managers',
      requestPayload: {
        business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
        date_from: '2021-01-24 06:00:00.000Z',
        date_to: '2023-02-01 06:00:00.000Z',
        source: 'facebook',
        // selected_campaigns: '',
        // selected_ad_sets: ''
      },
    }),
  );
}
