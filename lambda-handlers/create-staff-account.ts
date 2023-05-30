import { validatePayloadRequiredKeys } from './../shared/validatePayloadRequiredKeys';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { registerStaffUser } from '../shared/cognito';
import { saveStaffAccount, verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { CreateStaffAccountParams, Result } from '../shared/types';
import * as utils from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import * as Sentry from '@sentry/serverless';
import { createStaffAccountEmail } from '../shared/sendGrid';

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
      name: 'create-staff-account',
    },
  },
});

export const handler: AppSyncResolverHandler<
  CreateStaffAccountParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );
    utils.logInfo(context, 'Context');

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    validatePayloadRequiredKeys(
      ['first_name', 'last_name', 'email', 'password'],
      event.arguments.createStaffAccountInput,
    );

    const { email, first_name, last_name, password } =
      event.arguments.createStaffAccountInput;

    const cognitoUser = await registerStaffUser(
      event.arguments.createStaffAccountInput,
      auth.sub,
    );

    await saveStaffAccount(
      event.arguments.createStaffAccountInput,
      cognitoUser,
      auth.sub,
    );

    await createStaffAccountEmail(
      email,
      first_name,
      last_name,
      password,
      user?.first_name,
    );

    return successResponse(null, 'Staff account created successfully');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<CreateStaffAccountParams, Result<null>>(
    handler,
    buildTestEvent<CreateStaffAccountParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        createStaffAccountInput: {
          first_name: 'first_name',
          last_name: 'last_name',
          email: `adrian+staff${new Date().getTime()}@sirge.io`,
          password: 'TestPassword@1234',
        },
      },
    }),
  );
}
