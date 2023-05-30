import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateTimezoneCurrency,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { Result, UpdateTimezoneCurrencyParams } from '../shared/types';
import { logInfo } from '../shared/utils';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError } from '../shared/statusCodes';
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
      name: 'update-timezone-currency',
    },
  },
});

export const handler: AppSyncResolverHandler<
  UpdateTimezoneCurrencyParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { timezone, currency } = event.arguments.updateTimezoneCurrencyInput;

    if (user?.timezone || user?.currency) {
      throw new StatusCodeError(122);
    }

    await updateTimezoneCurrency({
      user,
      timezone,
      currency: currency.toUpperCase(),
    });

    return successResponse(null, 'Timezone and Currency selected.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UpdateTimezoneCurrencyParams, Result<null>>(
    handler,
    buildTestEvent<UpdateTimezoneCurrencyParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        updateTimezoneCurrencyInput: {
          timezone: 'america/chicago',
          currency: 'usd',
        },
      },
    }),
  );
}
