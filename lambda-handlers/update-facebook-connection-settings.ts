import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateFacebookConnectionSettings,
  verifyUserSubscription,
} from '../shared/mongoDb';
import {
  Result,
  UpdateFacebookConnectionSettingsParams,
} from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError, statusCodes } from '../shared/statusCodes';
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
      name: 'update-facebook-connection-settings',
    },
  },
});

export const handler: AppSyncResolverHandler<
  UpdateFacebookConnectionSettingsParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(87);
    }

    await updateFacebookConnectionSettings(
      user,
      event.arguments.updateFacebookConnectionSettingsInput,
    );

    return successResponse(null, statusCodes[149].message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UpdateFacebookConnectionSettingsParams, Result<null>>(
    handler,
    buildTestEvent<UpdateFacebookConnectionSettingsParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        updateFacebookConnectionSettingsInput: {
          business_id: '91a9012c-e2aa-49e8-810f-4c69d92f5fba',
          fb_pixel_id: 377907384345199,
        },
      },
    }),
  );
}
