import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { updateMontlyBudget, verifyUserSubscription } from '../shared/mongoDb';
import { Result, UpdateMonthlyBudgetParams } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError, statusCodes } from '../shared/statusCodes';
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
      name: 'update-monthly-budget',
    },
  },
});

export const handler: AppSyncResolverHandler<
  UpdateMonthlyBudgetParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    const { updateMonthlyBudgetInput } = event.arguments;

    if (!user) {
      throw new StatusCodeError(87);
    }

    await updateMontlyBudget(updateMonthlyBudgetInput);

    return successResponse(null, 'Monthly Budget updated');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UpdateMonthlyBudgetParams, Result<null>>(
    handler,
    buildTestEvent<UpdateMonthlyBudgetParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        updateMonthlyBudgetInput: {
          analytic_id: '8c6479b1-3778-4994-ba1e-39ebe93b73ad',
          amount: 3455252455,
        },
      },
    }),
  );
}
