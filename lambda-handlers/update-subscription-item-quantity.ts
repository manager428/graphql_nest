import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById, updateUserPageViewLimit } from '../shared/mongoDb';
import { Result } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
import { updateSubscriptionItems } from '../shared/stripe';
import {
  ItemQuantityResult,
  UpdateSubscriptionItemQuantityParams,
} from '../shared/types';
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
      name: 'update-subscription-item-quantity',
    },
  },
});

export const handler: AppSyncResolverHandler<
  UpdateSubscriptionItemQuantityParams,
  Result<ItemQuantityResult>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const user = await getUserById(auth?.sub);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { user_plan, subscription, products } = user;

    const { subscription_id, subscription_item_id, option } = event?.arguments;

    if (!subscription || subscription?.id !== subscription_id) {
      throw new StatusCodeError(88);
    }

    const decode = JSON.parse(
      Buffer.from(subscription?.subscription_body, 'base64').toString(),
    );

    const { status, items } = decode;

    if (status === 'trialing') {
      throw new StatusCodeError(95);
    }

    let productCode: string | null = null,
      quantity = null,
      itemData: ItemQuantityResult | null = null,
      message: string = 'Subscription updated.';

    for (const item of items?.data) {
      // make use of Array.find instead - a possibility
      const { id, price, quantity: itemQuantity } = item;
      let productId: string = price?.product;
      quantity = itemQuantity;

      if (id === subscription_item_id) {
        if (!products || products?.product_id !== productId) {
          throw new StatusCodeError(102);
        }

        productCode = products?.product_code;
        break;
      }
    }

    if (!productCode) {
      throw new StatusCodeError(92);
    }

    /** Possibly pass as an enums list */
    if (productCode === 'extra_page_views') {
      if (!option) {
        throw new StatusCodeError(113);
      }

      const planCode: string = user_plan?.plan_code;

      if (planCode !== 'bolt_pro') {
        throw new StatusCodeError(158);
      }

      const optionModified = option / 10000;

      if (optionModified > 20) {
        throw new StatusCodeError(133);
      }

      const current = quantity * 10000;
      const currentLimit = user_plan?.page_view_limit;

      if (Number(option) > current) {
        const increase: number = optionModified - quantity;

        if (increase === 0) {
          itemData = { limit: currentLimit, quantity };
          return successResponse(itemData, message);
        }

        await updateUserPageViewLimit(increase * 10000, user);

        await updateSubscriptionItems(subscription_item_id, {
          quantity: quantity + increase,
        });

        itemData = {
          limit: currentLimit + increase * 10000,
          quantity: quantity + increase,
        };

        return successResponse(itemData, message);
      } else {
        if (Number(option) > quantity * 10000) {
          throw new StatusCodeError(133);
        }

        const decrease = (quantity * 10000 - Number(option)) / 10000;

        if (decrease === 0) {
          itemData = { limit: currentLimit, quantity };
          return successResponse(itemData, message);
        }

        await updateUserPageViewLimit(decrease * 10000, user);

        await updateSubscriptionItems(subscription_item_id, {
          quantity: quantity - decrease,
        });

        itemData = {
          limit: currentLimit - decrease * 10000,
          quantity: quantity - decrease,
        };

        return successResponse(itemData, message);
      }
    } else {
      throw new StatusCodeError(93);
    }
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<
    UpdateSubscriptionItemQuantityParams,
    Result<ItemQuantityResult>
  >(
    handler,
    buildTestEvent<UpdateSubscriptionItemQuantityParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        subscription_id: 'sub_1JwkexBWXgc6iQOCEZk2iLy0',
        subscription_item_id: 'si_KbycZKybUdfUrC',
        option: 200,
      },
    }),
  );
}
