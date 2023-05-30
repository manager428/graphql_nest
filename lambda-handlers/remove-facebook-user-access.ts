import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateUserFacebookAccessDetails,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { Result } from '../shared/types';
import { logError, logInfo } from '../shared/utils';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError } from '../shared/statusCodes';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
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
      name: 'remove-facebook-user-access',
    },
  },
});

export type RemoveFacebookUserAccessParams = {};

export const handler: AppSyncResolverHandler<
  RemoveFacebookUserAccessParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user, isManager } = await verifyUserSubscription(
      auth,
    );

    if (!user || !isManager) {
      throw new StatusCodeError(185);
    }

    await updateUserFacebookAccessDetails({
      user,
      facebook_userID: null,
      facebook_accessToken: null,
    });

    return successResponse(null, 'Facebook user access removed.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  try {
    enableDebugMode<RemoveFacebookUserAccessParams, Result<null>>(
      handler,
      buildTestEvent<RemoveFacebookUserAccessParams>({
        userId: 'dbbf6b33-64aa-45f5-bb6f-da449b50f287',
        group: 'Managers',
        requestPayload: {},
      }),
    );
  } catch (e) {
    logError(e);
    process.exit(1);
  }
}
