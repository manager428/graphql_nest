import { VerifyTwoFactorParams } from '../shared/types';
import { AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { updateVerifyCodeById } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { getEventName } from '../shared/getEventName';
import { Result } from '../shared/types';
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
      name: 'post-verify-two-factor',
    },
  },
});

export const handler: AppSyncResolverHandler<
  VerifyTwoFactorParams,
  Result<boolean>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const {
      verifyTwoFactorInput: { two_factor_id },
    } = event.arguments as VerifyTwoFactorParams;

    const twoFactor = await updateVerifyCodeById(two_factor_id);

    logInfo('Two factor returned:', JSON.stringify(twoFactor));

    if (!twoFactor.valid) {
      throw new Error(twoFactor.message);
    }

    return successResponse(true, 'Two Factor Validated');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<VerifyTwoFactorParams, Result<boolean>>(
    handler,
    buildTestEvent<VerifyTwoFactorParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        verifyTwoFactorInput: {
          two_factor_id: '17a58aff-ae8c-4df8-a791-50afcfd7a365',
        },
      },
    }),
  );
}
