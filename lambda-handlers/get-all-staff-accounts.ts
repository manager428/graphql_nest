import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getAllStaffAccounts, verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { StatusCodeError } from '../shared/statusCodes';
import { successResponse } from '../shared/successResponse';
import { User } from '@sirge-io/sirge-utils';
import { Result } from '../shared/types';
import { logInfo } from '../shared/utils';
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
      name: 'get-all-staff-accounts',
    },
  },
});

export type GetStaffAccountsParams = {};

export const handler: AppSyncResolverHandler<
  GetStaffAccountsParams,
  Result<User[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user, isManager } = await verifyUserSubscription(
      auth,
    );

    if (!user) {
      throw new StatusCodeError(185);
    }

    if (!isManager) {
      throw new StatusCodeError(76);
    }

    const staffAccounts = await getAllStaffAccounts(auth.sub);

    return successResponse(
      staffAccounts,
      'Fetched staff accounts successfully',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetStaffAccountsParams, Result<User[]>>(
    handler,
    buildTestEvent<GetStaffAccountsParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
