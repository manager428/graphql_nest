import { AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { registerCognitoUser } from '../shared/cognito';
import { createTwoFactor, getUserByEmail, saveUser } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { RegisterUserParams, Result } from '../shared/types';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import * as utils from '../shared/utils';
import * as Sentry from '@sentry/serverless';
import { sendRegisterWelcomeEmail } from '../shared/sendGrid';
import { StatusCodeError } from '../shared/statusCodes';
import * as CryptoJS from 'crypto-js';
import { getEmailSecretEncrypt } from '../shared/config';

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
      name: 'register-user',
    },
  },
});

export const handler: AppSyncResolverHandler<
  RegisterUserParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );
    utils.logInfo(context, 'Context');

    const cognitoUser = await registerCognitoUser(
      event.arguments.registerUserInput,
    );

    const cryptoKey = await getEmailSecretEncrypt();

    await saveUser(event.arguments.registerUserInput, cognitoUser);

    const user = await getUserByEmail(event.arguments.registerUserInput.email);

    if (!user) {
      throw new StatusCodeError(111);
    }

    const twofactorId = await createTwoFactor(user.user_id, user.email);

    utils.logInfo('Generated Two Factor Record successfully ID=', twofactorId);

    const userCreds = {
      email: user.email,
      password: event.arguments.registerUserInput.password,
      twofactorId,
    };

    const encryptData = CryptoJS.AES.encrypt(
      JSON.stringify(userCreds),
      cryptoKey,
    ).toString();

    // to avoid breaking the client route
    const encryptedUrl = encryptData.split('/').join('$');

    const url = `${process.env.SENDGRID_HOST_URL}/confirm-email/${encryptedUrl}`;

    const result = await sendRegisterWelcomeEmail(
      user.email,
      user.first_name,
      url,
    );

    return successResponse(null, 'User created successfully');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<RegisterUserParams, Result<null>>(
    handler,
    buildTestEvent<RegisterUserParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        registerUserInput: {
          first_name: 'someTestUser',
          last_name: 'someTestUser',
          email: `adrian+manager${new Date().getTime()}@sirge.io`,
          password: 'P@ssword1',
          shopify_store_url: 'my_store_url',
        },
      },
    }),
  );
}
