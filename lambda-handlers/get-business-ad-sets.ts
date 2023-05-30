import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusiness,
  getExchangesRates,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { getPageViewsByGroup } from '../shared/postgresDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError } from '../shared/statusCodes';
import {
  FacebookAdSet,
  FacebookInsight,
  GetBusinessAdSetParams,
  Result,
} from '../shared/types';
import { AdSet, MarketingSources } from '@sirge-io/sirge-utils';
import { validatePayloadRequiredKeys } from '../shared/validatePayloadRequiredKeys';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { endOfDay, getFormatDate, startOfDay } from '../shared/time';
import { getTiktokAdGroup, getTiktokInsights } from '../shared/tiktok';
import { logInfo } from '../shared/utils';
import { TikTokSourceKeys } from '../shared/enums/tikTokSourceKeys';
import { FacebookSourceKeys } from '../shared/enums/facebookSources';
import { getFacebookAdSet, getFacebookInsights } from '../shared/facebook';
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
      name: 'get-business-ad-sets',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetBusinessAdSetParams,
  Result<AdSet[]> // TODO: Does adSet interface need source?
> = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);
    logInfo(context, 'Context');

    const auth = event.identity as AppSyncIdentityCognito;

    const {
      business_id,
      date_from = new Date(),
      date_to = new Date(),
      source,
      selected_campaigns = [],
    } = event.arguments.getBusinessAdSetInput;

    validatePayloadRequiredKeys(
      ['business_id', 'source'],
      event.arguments.getBusinessAdSetInput,
    );

    const { authenticatedUser, isManager, managingUser } =
      await verifyUserSubscription(auth);

    const user = isManager ? authenticatedUser : managingUser;

    if (!user) {
      throw new StatusCodeError(185);
    }

    if (source === MarketingSources.TIKTOK && !user.tik_tok_access_token) {
      throw new StatusCodeError(186);
    } else if (
      source === MarketingSources.FACEBOOK &&
      !user.facebook_accessToken
    ) {
      throw new StatusCodeError(59);
    }

    const business = await getBusiness(business_id);

    if (source === MarketingSources.TIKTOK && !business.tik_tok_ad_account_id) {
      throw new StatusCodeError(187);
    } else if (
      source === MarketingSources.FACEBOOK &&
      !business.facebook_ad_account_id
    ) {
      throw new StatusCodeError(59);
    }

    const {
      convert_currency,
      convert_two_currency,
      base_exchange_rate,
      account_exchange_rate,
    } = await getExchangesRates(authenticatedUser!, business);

    const sourceDateFrom = getFormatDate(new Date(date_from), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const sourceDateTo = getFormatDate(new Date(date_to), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const all_ad_sets: AdSet[] = await getPageViewsByGroup(
      business_id,
      source === 'tiktok'
        ? Object.keys(TikTokSourceKeys)
            .filter((v) => isNaN(Number(v)))
            .join("','")
        : Object.keys(FacebookSourceKeys)
            .filter((v) => isNaN(Number(v)))
            .join("','"),
      { array: selected_campaigns },
      new Date(
        startOfDay(date_from, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
      ),
      new Date(
        endOfDay(date_to, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }),
      ),
    );

    if (!all_ad_sets.length) {
      return successResponse(
        [],
        'Successfully pulled ad sets. No ad sets returned',
      );
    }

    let ad_sets_array: AdSet[] = [];

    let rows: number = 0;

    let total_source_amount_spent: number = 0;
    let total_source_clicks: number = 0;
    let total_source_purchases: number = 0;
    let total_source_conversion_value: number = 0;
    let total_sirge_clicks: number = 0;
    let total_sirge_purchases: number = 0;
    let total_sirge_total_conversion_value: number = 0;

    const promises = all_ad_sets.map(async (ad_set: AdSet) => {
      rows = rows + 1;
      let sirge_purchases = ad_set.purchases_count;
      let sirge_clicks = ad_set.clicks_count;
      let sirge_conversion_value = ad_set.conversion_value;

      let source_delivery_status: null | string = null;
      let source_data_amount_spent: number = 0;
      let source_data_clicks: number = 0;
      let source_data_purchases: number = 0;
      let source_data_cost_per_purchase: number = 0;
      let source_data_conversion_value: number = 0;
      let source_data_roas: string = '';

      let create_object = false;

      let skip_to_object_creation = false;

      if (ad_set.sirge_adset_id?.indexOf('__aid_name__') === 0) {
        skip_to_object_creation = true;
        rows = rows - 1;
      }

      if (ad_set.sirge_adset_id?.indexOf('__aid__') === 0) {
        skip_to_object_creation = true;
        rows = rows - 1;
      }

      if (ad_set.sirge_adset_id?.indexOf('adset.id') === 0) {
        skip_to_object_creation = true;
        rows = rows - 1;
      }

      if (!skip_to_object_creation) {
        create_object = true;

        let effective_status_arr;

        if (source === MarketingSources.TIKTOK) {
          effective_status_arr = await getTiktokAdGroup(
            user.tik_tok_access_token as string,
            business.tik_tok_ad_account_id as string,
            ad_set.sirge_adset_id!,
          );

          if (effective_status_arr.list.length === 0) {
            create_object = false;
          } else {
            create_object = true;
            source_delivery_status =
              effective_status_arr.list[0].primary_status == 'ENABLE'
                ? 'Active'
                : 'Disabled';

            let insights = await getTiktokInsights(
              user.tik_tok_access_token as string,
              business.tik_tok_ad_account_id as string,
              sourceDateFrom,
              sourceDateTo,
              ad_set.sirge_ad_id!,
              'adgroup_ids',
            );

            if (insights.list.length == 0) {
              //tiktok has no data for this. null all
            } else {
              let insight_data = insights.list[0].metrics;

              if (convert_currency) {
                if (convert_two_currency) {
                  let conversion_value_conversion1 = Math.round(
                    (insight_data.total_complete_payment_rate *
                      base_exchange_rate *
                      100) /
                      100,
                  );
                  let conversion_value_conversion2 = Math.round(
                    (conversion_value_conversion1 *
                      account_exchange_rate *
                      100) /
                      100,
                  );
                  source_data_conversion_value = conversion_value_conversion2;

                  let spend_value_conversion1 = Math.round(
                    (insight_data.spend * base_exchange_rate * 100) / 100,
                  );
                  let spend_value_conversion2 = Math.round(
                    (spend_value_conversion1 * account_exchange_rate * 100) /
                      100,
                  );
                  source_data_amount_spent = spend_value_conversion2;

                  let cost_per_purchase_value_conversion1 = Math.round(
                    (insight_data.cost_per_conversion *
                      base_exchange_rate *
                      100) /
                      100,
                  );
                  let cost_per_purchase_value_conversion2 = Math.round(
                    (cost_per_purchase_value_conversion1 *
                      account_exchange_rate *
                      100) /
                      100,
                  );
                  source_data_cost_per_purchase =
                    cost_per_purchase_value_conversion2;
                } else {
                  let conversion_value_conversion1 = Math.round(
                    (insight_data.total_complete_payment_rate *
                      account_exchange_rate *
                      100) /
                      100,
                  );
                  source_data_conversion_value = conversion_value_conversion1;

                  let spend_value_conversion1 = Math.round(
                    (insight_data.spend * account_exchange_rate * 100) / 100,
                  );
                  source_data_amount_spent = spend_value_conversion1;

                  let cost_per_purchase_value_conversion1 = Math.round(
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
        } else if (source === MarketingSources.FACEBOOK) {
          // Make fb requset

          const response = await getFacebookAdSet(
            ad_set.sirge_adset_id!,
            user.facebook_accessToken!,
          );

          if (!response.ok) {
            throw new StatusCodeError(68);
          }

          const jsonResponse: {
            data: FacebookAdSet;
            error: { type: string };
          } = await response.json();

          if (jsonResponse.error) {
            if (jsonResponse.error.type === 'OAuthException') {
              throw new StatusCodeError(59);
            } else {
              //null facebook values. no need to nullify done by default
              create_object = true;
            }
          } else {
            if (!jsonResponse.data.account_id) {
              create_object = false;
            } else {
              create_object = true;

              if (jsonResponse.data.effective_status) {
                effective_status_arr =
                  jsonResponse.data.effective_status.split('_');

                if (effective_status_arr.length > 1) {
                  source_delivery_status =
                    effective_status_arr[0] === 'ACTIVE'
                      ? `Active`
                      : `${effective_status_arr[0]} ${effective_status_arr[1]}`
                          .toLowerCase()
                          .toUpperCase();
                } else {
                  source_delivery_status =
                    effective_status_arr[0] === 'ACTIVE'
                      ? 'Active'
                      : effective_status_arr[0].toLowerCase().toUpperCase();
                }
              }

              const insightReponse = await getFacebookInsights(
                ad_set.sirge_adset_id!,
                user.facebook_accessToken!,
                sourceDateFrom,
                sourceDateTo,
              );

              if (!insightReponse.ok) {
                throw new StatusCodeError(68);
              }

              const jsonInsightReponse: {
                data: FacebookInsight[];
                error: { type: string };
              } = await response.json();

              if (jsonInsightReponse.error) {
                if (jsonInsightReponse.error.type === 'OAuthException') {
                  throw new StatusCodeError(59);
                }
              } else {
                if (jsonInsightReponse.data.length > 0) {
                  const facebook_adset_data = jsonInsightReponse.data[0];

                  if (convert_currency) {
                    let conversion1 = 0;
                    let conversion2 = 0;

                    if (convert_two_currency) {
                      conversion1 = Math.round(
                        (Math.floor(facebook_adset_data.spend) *
                          base_exchange_rate *
                          100) /
                          100,
                      );
                      conversion2 = Math.round(
                        (conversion1 * account_exchange_rate * 100) / 100,
                      );
                      source_data_amount_spent = conversion2;
                    } else {
                      conversion1 = Math.round(
                        (Math.floor(facebook_adset_data.spend) *
                          account_exchange_rate *
                          100) /
                          100,
                      );
                      source_data_amount_spent = conversion1;
                    }
                  } else {
                    source_data_amount_spent = Math.round(
                      Math.floor(facebook_adset_data.spend),
                    );
                  }

                  if (facebook_adset_data.purchase_roas.length) {
                    for (const roas of facebook_adset_data.purchase_roas) {
                      if (roas.action_type === 'omni_purchase') {
                        source_data_roas = `${Math.round(roas.value)}x`;
                        break;
                      }
                    }
                  }

                  if (facebook_adset_data.actions.length) {
                    for (const actions of facebook_adset_data.actions) {
                      if (actions.action_type === 'omni_purchase') {
                        source_data_purchases = actions.value;
                      } else if (actions.action_type === 'link_click') {
                        source_data_clicks = actions.value;
                      }
                    }
                  }

                  if (facebook_adset_data.cost_per_action_type.length) {
                    for (const actions_object of facebook_adset_data.cost_per_action_type) {
                      let conversion1 = 0;
                      let conversion2 = 0;

                      if (actions_object.action_type == 'purchase') {
                        if (convert_currency) {
                          if (convert_two_currency) {
                            conversion1 = Math.round(
                              (Math.floor(actions_object.value) *
                                base_exchange_rate *
                                100) /
                                100,
                            );
                            conversion2 = Math.round(
                              (Math.floor(actions_object.value) *
                                account_exchange_rate *
                                100) /
                                100,
                            );
                            source_data_cost_per_purchase = conversion2;
                          } else {
                            conversion1 = Math.round(
                              (Math.floor(actions_object.value) *
                                account_exchange_rate *
                                100) /
                                100,
                            );
                            source_data_cost_per_purchase = conversion1;
                          }
                        } else {
                          source_data_cost_per_purchase = Math.round(
                            Math.floor(actions_object.value),
                          );
                        }

                        break;
                      }
                    }
                  }

                  if (facebook_adset_data.action_values.length) {
                    for (const actions_object of facebook_adset_data.action_values) {
                      let conversion1 = 0;
                      let conversion2 = 0;

                      if (actions_object.action_type === 'omni_purchase') {
                        if (convert_currency) {
                          if (convert_two_currency) {
                            conversion1 = Math.round(
                              (Math.floor(actions_object.value) *
                                base_exchange_rate *
                                100) /
                                100,
                            );
                            conversion2 = Math.round(
                              (conversion1 * account_exchange_rate * 100) / 100,
                            );
                            source_data_conversion_value = conversion2;
                          } else {
                            conversion1 = Math.round(
                              (Math.floor(actions_object.value) *
                                account_exchange_rate *
                                100) /
                                100,
                            );
                            source_data_conversion_value = conversion1;
                          }
                        } else {
                          source_data_conversion_value = Math.round(
                            Math.floor(actions_object.value),
                          );
                        }

                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      let ad_set_name = ad_set.ad_set;

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

        let object: AdSet = {
          id: rows,
          source,
          source_delivery_status: source_delivery_status,
          sirge_adset_id: ad_set.sirge_adset_id,
          ad_set_name: ad_set_name,
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
          purchases_count: 0,
          clicks_count: 0,
          conversion_value: 0,
          ad_set: '',
          ad: '',
        };

        ad_sets_array.push(object);

        return ad_sets_array;
      }

      return ad_sets_array;
    });

    const all_data = await Promise.all(promises);

    if (all_data.length > 0) {
      let total_title_name = rows == 1 ? 'ad set' : 'ad sets';

      let total_object: AdSet = {
        id: rows + 1,
        source,
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
        purchases_count: 0,
        clicks_count: 0,
        conversion_value: 0,
        ad_set: '',
        ad: '',
      };

      ad_sets_array.push(total_object);
    }

    return successResponse(
      ad_sets_array,
      `${source} Ad sets retrieved successfully`,
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetBusinessAdSetParams, Result<AdSet[]>>(
    handler,
    buildTestEvent<GetBusinessAdSetParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Managers',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        getBusinessAdSetInput: {
          business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
          date_from: getFormatDate(new Date('2021-01-01')),
          date_to: getFormatDate(new Date()),
          source: MarketingSources.FACEBOOK,
          selected_campaigns: [6288836506060, 6288836506061],
        },
      },
    }),
  );
}
