import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  verifyUserSubscription,
  getPlanByPlanCode,
  countBusinessByStatus,
  updateUser,
} from '../shared/mongoDb';
import { Result, UpdateSubscriptionPlanParams } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
import {
  BusinessStatus,
  SubscriptionStatuses,
  User,
  PlanCode,
  BoltBasicPlan,
  BoltProPlan,
} from '@sirge-io/sirge-utils';

import { updateStripeSubscription, voidInvoices } from '../shared/stripe';
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
      name: 'update-subscription-plan',
    },
  },
});

export const handler: AppSyncResolverHandler<
  UpdateSubscriptionPlanParams,
  Result<User>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { user_plan, subscription } = user;

    const { to_plan_code } = event?.arguments.updateSubscriptionPlanInput;

    const decode = JSON.parse(
      Buffer.from(subscription?.subscription_body, 'base64').toString(),
    );

    const { status, items } = decode;

    //  plan to check
    const {
      selectedPlanJson: {
        plan_price_id,
        plan_code,
        business_limit,
        plan_product_id,
      },
    } = await getPlanByPlanCode(to_plan_code);

    if (!PlanCode[plan_code]) {
      throw new StatusCodeError(97);
    }

    const subscriptionData: { id: string; priceIds: string }[] =
      items?.data.map((item: { id: string; price: { id: string } }) => ({
        id: item.id,
        priceIds: item.price.id,
      }));

    if (subscriptionData.find((item) => item.priceIds === plan_price_id)) {
      throw new StatusCodeError(99);
    }

    const updatePlanItem = subscriptionData.map((item) => ({
      id: item.id,
      price: plan_price_id,
      quantity: 1,
    }));

    // validate business limit to downgrade plan
    if (
      !!BoltProPlan[user_plan.plan_code as keyof typeof BoltProPlan] &&
      !!BoltBasicPlan[to_plan_code as keyof typeof BoltBasicPlan]
    ) {
      const { businessCount } = await countBusinessByStatus({
        user_id: user.user_id,
        status: BusinessStatus.ACTIVE,
      });

      const limit = user.business_limit - business_limit;

      if (businessCount > limit) {
        throw new Error(
          `You must deactivate ${limit} ${
            limit > 1 ? 'businesses' : 'business'
          } Before downgrading`,
        );
      }
    }

    let subscriptionUpdated;

    if (status === SubscriptionStatuses.TRIALING) {
      subscriptionUpdated = await updateStripeSubscription(
        user.subscription.id,
        {
          trial_end: 'now',
          payment_behavior: 'pending_if_incomplete',
          proration_behavior: 'always_invoice',
          items: updatePlanItem,
        },
      );

      await updateUser(
        {
          end_trial_source: 'change plan - billing',
        },
        user.user_id,
      );
    } else {
      subscriptionUpdated = await updateStripeSubscription(
        user.subscription.id,
        {
          payment_behavior: 'pending_if_incomplete',
          proration_behavior: 'always_invoice',
          items: updatePlanItem,
        },
      );
    }

    if (subscriptionUpdated.pending_update) {
      await voidInvoices(user.subscription.id);

      throw new StatusCodeError(101);
    }

    const { modifiedUser } = await updateUser(
      {
        business_limit: user.business_limit + business_limit,
        plan_product_id,
        plan_price_id,
      },
      user.user_id,
    );

    return successResponse(modifiedUser, 'Plan changed successfully');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UpdateSubscriptionPlanParams, Result<User>>(
    handler,
    buildTestEvent<UpdateSubscriptionPlanParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff6b',
      group: 'Managers',
      requestPayload: {
        updateSubscriptionPlanInput: {
          to_plan_code: 'bolt_basic',
        },
      },
    }),
  );
}
