import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById, updateUserSubscription } from '../shared/mongoDb';
import { Result, SubscribeInput } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError, statusCodes } from '../shared/statusCodes';
import { InvoiceStatus, SubscriptionStatuses } from '@sirge-io/sirge-utils';
import { createStripeSubscription } from '../shared/stripe';
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
      name: 'subscribe',
    },
  },
});

export const handler: AppSyncResolverHandler<
  SubscribeInput,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const user = await getUserById(auth?.sub);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const stripeCustomerId = user?.subscription?.customer_id;

    const invoices = user?.invoices.filter(
      (invoice) =>
        invoice.customer_id === stripeCustomerId &&
        invoice.status === InvoiceStatus.UNCOLLECTABLE,
    );

    if (invoices.length > 0) {
      throw new StatusCodeError(114);
    }

    if (user?.subscription?.status === SubscriptionStatuses.ACTIVE) {
      throw new StatusCodeError(106);
    }

    const selectedPlan = user?.user_plan;

    const { business_limit, plan_price_id, plan_product_id } = selectedPlan;

    let subscriptionItems = [
      {
        price: plan_price_id,
        quantity: 1,
      },
    ];

    const subscription = await createStripeSubscription({
      customer: stripeCustomerId,
      automatic_tax: { enabled: true },
      collection_method: 'charge_automatically',
      payment_behavior: 'error_if_incomplete',
      items: subscriptionItems,
    });

    const { id, status, current_period_start, current_period_end } =
      subscription;

    const params = {
      user,
      business_limit,
      plan_price_id,
      plan_product_id,
      subscription_id: id,
      subscription_status: status,
      current_billing_period_start: current_period_start,
      current_billing_period_end: current_period_end,
    };

    await updateUserSubscription(params);

    return successResponse(null, statusCodes[115].message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<SubscribeInput, Result<null>>(
    handler,
    buildTestEvent<SubscribeInput>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        plan_code: 'bolt_pro',
      },
    }),
  );
}
