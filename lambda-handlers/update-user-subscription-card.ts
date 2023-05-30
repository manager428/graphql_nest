import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateUserSubscriptionCard,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { Result, UpdateSubscriptionCardParams } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError, statusCodes } from '../shared/statusCodes';
import { createStripePaymentMethod } from '../shared/stripe';
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
      name: 'update-user-subscription-card',
    },
  },
});

export const handler: AppSyncResolverHandler<
  UpdateSubscriptionCardParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user, isManager } = await verifyUserSubscription(
      auth,
    );

    const { card_number, card_expiry_date, card_cvc } =
      event.arguments.updateUserSubscriptionCardInput;

    if (!isManager || !user) {
      throw new StatusCodeError(87);
    }

    const paymentMethod = await createStripePaymentMethod({
      type: 'card',
      card: {
        number: card_number,
        exp_month: Number(
          card_expiry_date.substring(0, card_expiry_date.length === 5 ? 2 : 1),
        ),
        exp_year: Number(
          card_expiry_date.substring(
            card_expiry_date.length === 5 ? 3 : 2,
            card_expiry_date.length,
          ),
        ),
        cvc: card_cvc,
      },
    });

    await updateUserSubscriptionCard(user, {
      ...event.arguments.updateUserSubscriptionCardInput,
      payment_method: paymentMethod.id,
    });

    return successResponse(null, statusCodes[96].message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UpdateSubscriptionCardParams, Result<null>>(
    handler,
    buildTestEvent<UpdateSubscriptionCardParams>({
      userId: 'd874f932-6dd7-4835-be55-7b585ae3610f',
      group: 'Managers',
      requestPayload: {
        updateUserSubscriptionCardInput: {
          card_number: '4242424242424242',
          card_last_four_digits: '4242',
          card_expiry_date: '8/23',
          card_type: 'visa',
          card_cvc: '123',
        },
      },
    }),
  );
}
