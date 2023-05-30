import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  checkBusiness,
  getExchangesRates,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Result } from '../shared/types';
import { CampaignsTikTok } from '@sirge-io/sirge-utils';
import {
  getInfoCampaignsFacebook,
  getInfoCampaignsTikTok,
  logInfo,
} from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getPageViewsCampaigns } from '../shared/postgresDb';
import { getFormatDate, startOfDay } from '../shared/time';
import { getCampaingsTikTok, getReportsTikTok } from '../shared/tiktok';
import { getFacebookCampaigns, getFacebookReports } from '../shared/facebook';
import { MarketingSources } from '@sirge-io/sirge-types';
import { TikTokSourceKeys } from '../shared/enums/tikTokSourceKeys';
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
      name: 'get-business-campaigns',
    },
  },
});

const checkIfFacebookSource = (source: MarketingSources) =>
  source.toLowerCase() === MarketingSources.FACEBOOK;

export type GetBusinessCampaignsParams = {
  business_id: string;
  date_from?: string;
  date_to?: string;
  source: MarketingSources;
  selected_campaigns?: string;
};

export const handler: AppSyncResolverHandler<
  GetBusinessCampaignsParams,
  Result<CampaignsTikTok[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    const { business_id, date_from, date_to, selected_campaigns, source } =
      event.arguments as GetBusinessCampaignsParams;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await checkBusiness(business_id);

    if (source === 'tiktok' && !authenticatedUser?.tik_tok_access_token) {
      throw new StatusCodeError(186);
    } else if (
      checkIfFacebookSource(source) &&
      !authenticatedUser?.facebook_accessToken
    ) {
      throw new StatusCodeError(59);
    }

    let sirge_date_from = startOfDay(date_from as string, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    let sirge_date_to = startOfDay(date_to as string, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    let source_date_from = getFormatDate(date_from as string, {
      dateStyle: 'short',
    });

    let source_date_to = getFormatDate(date_to as string, {
      dateStyle: 'short',
    });

    const {
      convert_currency,
      convert_two_currency,
      base_exchange_rate,
      account_exchange_rate,
    } = await getExchangesRates(authenticatedUser!, business);

    const all_campaigns = await getPageViewsCampaigns(
      business_id,
      source === MarketingSources.TIKTOK
        ? Object.keys(TikTokSourceKeys)
            .filter((v) => isNaN(Number(v)))
            .join(',')
        : Object.keys(FacebookSourceKeys)
            .filter((v) => isNaN(Number(v)))
            .join(','),
      selected_campaigns as string,
      sirge_date_from,
      sirge_date_to,
    );

    if (all_campaigns.length === 0) {
      return successResponse(
        [],
        `${
          checkIfFacebookSource(source) ? 'Facebook' : 'Tik Tok'
        } campaigns found.`,
      );
    }

    let total_source_amount_spent = 0;
    let total_source_clicks = 0;
    let total_source_purchases = 0;
    let total_source_conversion_value = 0;
    let total_sirge_clicks = 0;
    let total_sirge_purchases = 0;
    let total_sirge_total_conversion_value = 0;

    const campaigns_array: CampaignsTikTok[] = [];

    const promises = all_campaigns.map(async (campaign, index) => {
      let sirge_purchases: number = Number(campaign.purchases_count);
      let sirge_clicks: number = Number(campaign.clicks_count);
      let sirge_conversion_value: number = Number(campaign.conversion_value);

      let source_delivery_status = null;
      let insights = null;
      let skip_to_object_creation = false;

      if (
        String(campaign.sirge_campaign_id)?.indexOf('__campaign_id__') === 0
      ) {
        skip_to_object_creation = true;
      }

      if (!skip_to_object_creation) {
        const effective_status_arr = checkIfFacebookSource(source)
          ? await getFacebookCampaigns(
              authenticatedUser?.facebook_accessToken as string,
              String(campaign.sirge_campaign_id),
            )
          : await getCampaingsTikTok(
              authenticatedUser?.tik_tok_access_token as string,
              business?.tik_tok_ad_account_id as string,
              String(campaign.sirge_campaign_id),
            );

        if (effective_status_arr.length > 0) {
          if (effective_status_arr[0].operation_status) {
            source_delivery_status =
              effective_status_arr[0].operation_status === 'ENABLE'
                ? 'Active'
                : 'Disabled';
          } else {
            source_delivery_status =
              effective_status_arr[0] === 'ACTIVE'
                ? 'Active'
                : `${effective_status_arr[0]} ${effective_status_arr[1]}`;
          }

          insights = checkIfFacebookSource(source)
            ? await getFacebookReports(
                authenticatedUser?.facebook_accessToken as string,
                String(campaign.sirge_campaign_id),
                source_date_from,
                source_date_to,
              )
            : await getReportsTikTok(
                authenticatedUser?.tik_tok_access_token as string,
                business?.tik_tok_ad_account_id as string,
                String(campaign.sirge_campaign_id),
                source_date_from,
                source_date_to,
              );
        }

        const {
          source_data_amount_spent,
          source_data_clicks,
          source_data_purchases,
          source_data_conversion_value,
          source_data_cost_per_purchase,
          source_data_roas,
        } = checkIfFacebookSource(source)
          ? getInfoCampaignsFacebook(
              insights,
              convert_currency,
              convert_two_currency,
              base_exchange_rate,
              account_exchange_rate,
            )
          : getInfoCampaignsTikTok(
              insights,
              convert_currency,
              convert_two_currency,
              base_exchange_rate,
              account_exchange_rate,
            );

        let campaign_name: string = campaign.campaign as string;

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

        let object: CampaignsTikTok = {
          id: index,
          source_delivery_status: source_delivery_status,
          sirge_campaign_id: String(campaign.sirge_campaign_id),
          campaign_name: campaign_name,
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
              ? `${Number(
                  sirge_conversion_value / source_data_amount_spent,
                ).toFixed(2)} x`
              : null
            : null,
        };

        return campaigns_array.push(object);
      }
    });

    const all_data = await Promise.all(promises);

    if (all_data.length > 0) {
      let total_title_name =
        all_campaigns.length === 1 ? 'campaign' : 'campaigns';

      let total_object: CampaignsTikTok = {
        id: all_campaigns.length,
        total_title: `Results from ${all_campaigns.length} ${total_title_name}`,
        amount_spent: total_source_amount_spent,
        clicks: total_source_clicks ? total_source_clicks : null,
        purchases: total_source_purchases ? total_source_purchases : null,
        cost_per_purchase: total_source_amount_spent
          ? total_source_purchases
            ? Math.round(total_source_amount_spent / total_source_purchases)
            : null
          : null,
        total_conversion_value: total_source_conversion_value
          ? total_source_conversion_value
          : null,
        roas: total_source_amount_spent
          ? total_source_conversion_value
            ? `${Math.round(
                total_source_conversion_value / total_source_amount_spent,
              )} x`
            : null
          : null,
        sirge_clicks: total_sirge_clicks ? total_sirge_clicks : null,
        sirge_purchases: total_sirge_purchases ? total_sirge_purchases : null,
        sirge_cost_per_purchase: total_source_amount_spent
          ? total_sirge_purchases
            ? Math.round(total_source_amount_spent / total_sirge_purchases)
            : null
          : null,
        sirge_total_conversion_value: total_sirge_total_conversion_value
          ? total_sirge_total_conversion_value
          : null,
        sirge_roas: total_source_amount_spent
          ? total_sirge_total_conversion_value
            ? `${Number(
                total_sirge_total_conversion_value / total_source_amount_spent,
              ).toFixed(2)} x`
            : null
          : null,
      };

      campaigns_array.push(total_object);
    }

    return successResponse(
      campaigns_array,
      `${
        checkIfFacebookSource(source) ? 'Facebook' : 'Tik Tok'
      } Campaigns for business found.`,
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetBusinessCampaignsParams, Result<CampaignsTikTok[]>>(
    handler,
    buildTestEvent<GetBusinessCampaignsParams>({
      userId: 'dbbf6b33-64aa-45f5-bb6f-da449b50f287',
      group: 'Managers',
      requestPayload: {
        business_id: 'c7a5cb5d-d0da-48db-8b28-c0a954074ebf',
        date_from: '2022-06-04',
        date_to: '2022-12-04',
        source: MarketingSources.FACEBOOK,
        selected_campaigns: '[]',
      },
    }),
  );
}
