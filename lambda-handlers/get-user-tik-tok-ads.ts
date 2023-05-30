import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { ConnectUserTikTokParams, Result, TiktokAds } from '../shared/types';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getUserTikTokAds } from '../shared/tiktok';
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
      name: 'get-user-tik-tok-ads',
    },
  },
});

export const handler: AppSyncResolverHandler<
  ConnectUserTikTokParams,
  Result<TiktokAds[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { isManager } = await verifyUserSubscription(auth);

    if (!isManager) {
      throw new StatusCodeError(76);
    }

    const { tik_tok_access_token } = event.arguments.getUserTiktokAdsInput;

    if (!tik_tok_access_token) {
      throw new StatusCodeError(186);
    }

    const ads = await getUserTikTokAds(tik_tok_access_token);
    return successResponse(ads, 'Tik Tok Ads found.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<ConnectUserTikTokParams, Result<TiktokAds[]>>(
    handler,
    buildTestEvent<ConnectUserTikTokParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getUserTiktokAdsInput: {
          tik_tok_access_token: 'aadf988009f2bbb5174a1798d09fd504f14621b1',
        },
      },
    }),
  );
}
