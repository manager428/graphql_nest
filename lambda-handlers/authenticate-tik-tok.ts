import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { setTikToktoken, verifyUserSubscription } from '../shared/mongoDb';
import { AuthenticateTikTokParams, Result } from '../shared/types';
import { logError, logInfo } from '../shared/utils';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError } from '../shared/statusCodes';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getTikTokAccessToken } from '../shared/tiktok';
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
      name: 'authenticate-tik-tok',
    },
  },
});

export const handler: AppSyncResolverHandler<
  AuthenticateTikTokParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { auth_code } = event.arguments.authenticateTikTokInput;

    if (!auth_code || auth_code === '') {
      throw new StatusCodeError(81);
    }

    const access_token = await getTikTokAccessToken(auth_code);

    await setTikToktoken(user.user_id, access_token);

    return successResponse(null, 'User Authenticated on Tik Tok.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  try {
    enableDebugMode<AuthenticateTikTokParams, Result<null>>(
      handler,
      buildTestEvent<AuthenticateTikTokParams>({
        userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
        group: 'Managers',
        requestPayload: {
          authenticateTikTokInput: {
            auth_code: 'fdd9e5a6fa55717dab5df347b9774b5e1e86a0eb',
          },
        },
      }),
    );
  } catch (e) {
    logError(e);
    process.exit(1);
  }
}
