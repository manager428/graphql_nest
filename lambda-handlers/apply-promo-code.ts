import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById } from '../shared/mongoDb';
import { ApplyPromoCodeInput, Result } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError, statusCodes } from '../shared/statusCodes';
import { getAllPromoCodes, updateStripeSubscription } from '../shared/stripe';
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
      name: 'apply-promo-code',
    },
  },
});

export const handler: AppSyncResolverHandler<
  ApplyPromoCodeInput,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const promoCode = await getAllPromoCodes({ code: event?.arguments?.code });

    if (promoCode?.data.length === 0) {
      throw new StatusCodeError(175);
    }

    const user = await getUserById(auth?.sub);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const code = promoCode?.data[0];

    if (!code?.coupon?.valid) {
      throw new StatusCodeError(175);
    }

    await updateStripeSubscription(user?.subscription?.id, {
      promotion_code: code?.id,
    });

    const message = statusCodes[176].message;

    return successResponse(null, message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<ApplyPromoCodeInput, Result<null>>(
    handler,
    buildTestEvent<ApplyPromoCodeInput>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        code: 'TS0EQJHH',
      },
    }),
  );
}
