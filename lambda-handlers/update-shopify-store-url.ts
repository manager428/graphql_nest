import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusiness,
  updateBusinessShopifyStoreUrl,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { Result, UpdateShopifyUrlParams } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
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
  UpdateShopifyUrlParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    const { business_id, shopify_url } =
      event.arguments.updateShopifyStoreUrlInput;

    if (!user) {
      throw new StatusCodeError(185);
    }

    const business = await getBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(1);
    }

    await updateBusinessShopifyStoreUrl(shopify_url, user.user_id, business_id);

    return successResponse(null, 'Shopify url successfully updated');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UpdateShopifyUrlParams, Result<null>>(
    handler,
    buildTestEvent<UpdateShopifyUrlParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        updateShopifyStoreUrlInput: {
          business_id: '69daf650-961f-42ef-9c24-906efba052f0',
          shopify_url: 'https://exampleee.com',
        },
      },
    }),
  );
}
