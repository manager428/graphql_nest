import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { updateUser, verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { UpdateUserParams, Result } from '../shared/types';
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
      name: 'update-user',
    },
  },
});

export const handler: AppSyncResolverHandler<
  UpdateUserParams,
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

    const {
      updateUserInput: {
        first_name,
        last_name,
        full_address,
        postal_code,
        country_name,
      },
    } = event.arguments as UpdateUserParams;

    const { modifiedUser } = await updateUser(
      {
        first_name,
        last_name,
        full_address,
        postal_code,
        country_name,
      },
      user?.user_id,
    );

    return successResponse(modifiedUser, 'User updated successfully');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UpdateUserParams, Result<User>>(
    handler,
    buildTestEvent<UpdateUserParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4b8',
      group: 'Managers',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        updateUserInput: {
          first_name: 'someTestUser1',
          last_name: 'someTestUser',
          full_address: '3701 Alness Street',
          postal_code: '95014',
          country_name: 'US',
          country_code: 'US',
        },
      },
    }),
  );
}
