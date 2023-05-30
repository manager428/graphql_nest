import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateStaffAccountAccess,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { StatusCodeError } from '../shared/statusCodes';
import { successResponse } from '../shared/successResponse';
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
      name: 'update-staff-account-access',
    },
  },
});

export type UpdateStaffAccountAccessParams = {
  updateStaffAccountAccessInput: UpdateStaffAccountAccessInput;
};

export type UpdateStaffAccountAccessInput = {
  vanity_name: string;
  staff_id: string;
};

export const handler: AppSyncResolverHandler<
  UpdateStaffAccountAccessParams,
  Result<null>
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

    await updateStaffAccountAccess(
      event.arguments.updateStaffAccountAccessInput,
      auth.sub,
    );

    return successResponse(null, 'Staff account access updated successfully');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UpdateStaffAccountAccessParams, Result<null>>(
    handler,
    buildTestEvent<UpdateStaffAccountAccessParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        updateStaffAccountAccessInput: {
          vanity_name: 'f1f1bb91-26e3-4ab6-84c6-a90c817606f9',
          staff_id: '6daadd85-784c-45d6-a724-87dcbe43930b',
        },
      },
    }),
  );
}
