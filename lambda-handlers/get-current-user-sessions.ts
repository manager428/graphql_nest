import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserSessions, verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { GetUserSessionParams, Result, UserSession } from '../shared/types';
import * as utils from '../shared/utils';
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
      name: 'get-current-user-sessions',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetUserSessionParams,
  Result<UserSession[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    if (!authenticatedUser) {
      throw new StatusCodeError(185);
    }

    const sessions = await getUserSessions(authenticatedUser?.user_id);

    return successResponse(sessions, 'Successfully fetched sessions');
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<GetUserSessionParams, Result<UserSession[]>>(
    handler,
    buildTestEvent<GetUserSessionParams>({
      userId: '00a4749e-f0f8-4c17-9da7-38a153128dd4',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
