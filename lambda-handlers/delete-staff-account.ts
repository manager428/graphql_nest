import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { deleteStaffUserCognito } from '../shared/cognito';
import { deleteStaffAccount, verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { getEventName } from '../shared/getEventName';
import { User } from '@sirge-io/sirge-utils';
import { DeleteStaffAccountParams, Result } from '../shared/types';
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
      name: 'delete-staff-account',
    },
  },
});

export type DeleteStaffAccountInput = {
  staff_id: string;
};

export const handler: AppSyncResolverHandler<
  DeleteStaffAccountParams,
  Result<User>
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

    const deltedUser = await deleteStaffAccount(
      event.arguments.deleteStaffAccountInput.staff_id,
      auth.sub,
    );

    await deleteStaffUserCognito(
      event.arguments.deleteStaffAccountInput.staff_id,
    );

    return successResponse(deltedUser, 'Staff account deleted successfully');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<DeleteStaffAccountParams, Result<User>>(
    handler,
    buildTestEvent<DeleteStaffAccountParams>({
      userId: 'fea757af-1723-4cb4-9e93-313c3ae4ff3c',
      group: 'Managers',
      requestPayload: {
        deleteStaffAccountInput: {
          staff_id: '3ed5e0f8-4057-44e8-bba1-70e68e5ad75a',
        },
      },
    }),
  );
}
