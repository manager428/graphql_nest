import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  setBusinessTiktokAdAccount,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Business } from '@sirge-io/sirge-utils';
import {
  AdAccountTikTokParams,
  TikTokBusinessAdAccountResponse,
  Result,
} from '../shared/types';
import * as utils from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
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
      name: 'post-business-tiktok-ad-account',
    },
  },
});

export const handler: AppSyncResolverHandler<
  AdAccountTikTokParams,
  Result<Business>
> = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );
    utils.logInfo(context, 'Context');

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    const { business_id, tik_tok_ad_account_id, tik_tok_ad_account_name } =
      event.arguments.AdAccountTiktokBussinesInput;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    if (!user) {
      throw new StatusCodeError(185);
    }

    if (!user.tik_tok_access_token) {
      throw new StatusCodeError(186);
    }

    if (!tik_tok_ad_account_id) {
      throw new StatusCodeError(187);
    }

    if (!tik_tok_ad_account_name) {
      throw new StatusCodeError(188);
    }

    const headers = {
      'Access-Token': user.tik_tok_access_token,
    };

    const url = `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?fields=["name","timezone","currency"]&advertiser_ids=["${tik_tok_ad_account_id}"]`;

    const data: Promise<TikTokBusinessAdAccountResponse> = await fetch(url, {
      headers,
    })
      .then((response) => response.json())
      .then((res) => res.data.list[0]);

    const adAccountInfo = await data;

    const business = await setBusinessTiktokAdAccount(
      user.user_id,
      business_id,
      tik_tok_ad_account_id,
      tik_tok_ad_account_name,
      adAccountInfo.currency,
      adAccountInfo.timezone,
    );

    return successResponse(business, 'Ad account set.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<AdAccountTikTokParams, Result<Business>>(
    handler,
    buildTestEvent<AdAccountTikTokParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        AdAccountTiktokBussinesInput: {
          business_id: '63677d9f-212f-4f14-9a1a-c421594fe126',
          tik_tok_ad_account_id: '7145915099432189953',
          tik_tok_ad_account_name: 'MRSLIMEY0921',
        },
      },
    }),
  );
}
