import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getStaffById, verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Result, GetStaffByIdParams } from '../shared/types';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import * as utils from '../shared/utils';
import { StatusCodeError } from '../shared/statusCodes';
import { User } from '@sirge-io/sirge-utils';
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
      name: 'get-staff-byId',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetStaffByIdParams,
  Result<User>
> = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );
    utils.logInfo(context, 'Context');

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { staff_id } = event?.arguments.getStaffByIdInput;

    const staff = await getStaffById(user.user_id, staff_id);

    utils.logInfo(`Staff returned: ${JSON.stringify(user)}`);

    return successResponse(staff);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetStaffByIdParams, Result<User>>(
    handler,
    buildTestEvent<GetStaffByIdParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        getStaffByIdInput: {
          staff_id: '8b9c9657-9d69-496e-9c6c-18357c0edad1',
        },
      },
    }),
  );
}
