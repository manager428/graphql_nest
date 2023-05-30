import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { verifyUserSubscription } from '../shared/mongoDb';
import { Plan } from '@sirge-io/sirge-utils';
import { Result } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
import { checkSubscriptionStatus } from '../shared/checkSubscriptionStatus';
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
      name: 'get-subscription',
    },
  },
});

export type GetSubscriptionParams = {};

type PlanInfo = {
  details: Plan;
  unit_amount: string;
  quantity: number;
  billing_scheme: string;
  price_id: string;
};

export type SubscriptionObjectResponse = {
  subscription_id: string;
  billing_cycle_anchor: number;
  current_billing_period_start: number;
  current_billing_period_end: number;
  status: string;
  trial_start: number;
  trial_end: number;
  plan: PlanInfo;
};

export const handler: AppSyncResolverHandler<
  GetSubscriptionParams,
  Result<SubscriptionObjectResponse>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { user_plan: plan, subscription } = user;

    checkSubscriptionStatus(user);

    const subscriptionBody = Buffer.from(
      subscription.subscription_body,
      'base64',
    ).toString();

    const decode = JSON.parse(subscriptionBody);

    const subscriptionId = decode.id;
    const billingCycleAnchor = decode.billing_cycle_anchor;
    const currentBillingPeriodStart = decode.current_period_start;
    const currentBillingPeriodEnd = decode.current_period_end;
    const status = decode.status;
    const trialStart = decode.trial_start;
    const trialEnd = decode.trial_end;

    const items = decode.items;
    let planInfo;

    for (const item of items.data) {
      const price = item.price;
      const priceId = price.id;
      const productId = price.product;

      if (
        plan &&
        plan?.plan_product_id === productId &&
        plan?.plan_price_id === priceId
      ) {
        planInfo = {
          details: plan,
          unit_amount: price.unit_amount,
          quantity: item.quantity,
          billing_scheme: price.billing_scheme,
          price_id: priceId,
        };

        break;
      }
    }

    const subscriptionObject = {
      subscription_id: subscriptionId,
      billing_cycle_anchor: billingCycleAnchor,
      current_billing_period_start: currentBillingPeriodStart,
      current_billing_period_end: currentBillingPeriodEnd,
      status: status,
      trial_start: trialStart,
      trial_end: trialEnd,
      plan: planInfo as PlanInfo,
    };

    return successResponse(
      subscriptionObject,
      'Subscription fetched succesfully',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetSubscriptionParams, Result<SubscriptionObjectResponse>>(
    handler,
    buildTestEvent<GetSubscriptionParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
