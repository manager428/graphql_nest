import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { createTwoFactor, getUserByEmail } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { PasswordResetParams, Result } from '../shared/types';
import * as utils from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { sendPasswordResetEmail } from '../shared/sendGrid';
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
      name: 'post-request-password-link',
    },
  },
});

export const handler: AppSyncResolverHandler<
  PasswordResetParams,
  Result<boolean>
> = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );
    utils.logInfo(context, 'Context');

    //look up user see if they exist
    const user = await getUserByEmail(event.arguments.passwordResetInput.email);

    if (!user) {
      throw new StatusCodeError(111);
    }

    const twofactorId = await createTwoFactor(user.user_id, user.email);

    utils.logInfo('Generated Two Factor Record successfully ID=', twofactorId);

    const url = `${process.env.SENDGRID_HOST_URL}/forgot/reset/${twofactorId}`;

    await sendPasswordResetEmail(
      user.email,
      user.first_name,
      user.last_name,
      url,
    );

    return successResponse(
      true,
      `Password reset link sent to ${event.arguments.passwordResetInput.email}. Please check your spam folder.`,
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<PasswordResetParams, Result<boolean>>(
    handler,
    buildTestEvent<PasswordResetParams>({
      userId: '4edbdc3d-96b5-4eff-be30-743910d284b1',
      group: 'Managers',
      requestPayload: {
        passwordResetInput: {
          email: 'adrian+manager1679350027885@sirge.io',
        },
      },
    }),
  );
}
