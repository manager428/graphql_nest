import { ChangePasswordParams } from '../shared/types';
import { AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserByVerifyCodeId } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { getEventName } from '../shared/getEventName';
import { Result } from '../shared/types';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { changePassword } from '../shared/cognito';
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
      name: 'post-change-password',
    },
  },
});

export const handler: AppSyncResolverHandler<
  ChangePasswordParams,
  Result<boolean>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const {
      changePasswordInput: { two_factor_id, password },
    } = event.arguments as ChangePasswordParams;

    const user = await getUserByVerifyCodeId(two_factor_id);

    const result = (await changePassword({ password, email: user.email })) as {
      $response: Record<string, unknown>;
    };

    logInfo(JSON.stringify(result), 'ChangePassword Returned');

    if (result.$response.error) {
      throw new Error(JSON.stringify(result.$response.error));
    }

    return successResponse(true, 'Password Change Successfully');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<ChangePasswordParams, Result<boolean>>(
    handler,
    buildTestEvent<ChangePasswordParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        changePasswordInput: {
          two_factor_id: '17a58aff-ae8c-4df8-a791-50afcfd7a365',
          password: 'SirgeForTheWin2023!!',
        },
      },
    }),
  );
}
