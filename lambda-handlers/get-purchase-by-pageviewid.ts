import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessStatusByUserId,
  getPageViewPurchase,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { BusinessStatus } from '@sirge-io/sirge-utils';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import {
  Result,
  BusinessPageViewPurchase,
  GetPageViewParams,
} from '../shared/types';
import { logInfo } from '../shared/utils';
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
      name: 'get-purchase-by-pageviewid',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetPageViewParams,
  Result<BusinessPageViewPurchase>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const {
      getPageViewInput: { business_id, pageview_id },
    } = event.arguments as GetPageViewParams;

    await getBusinessStatusByUserId({
      business_id,
      user_id: user?.user_id,
      status: BusinessStatus.ACTIVE,
    });

    const purchaseview = await getPageViewPurchase(business_id, pageview_id);

    return successResponse<BusinessPageViewPurchase>({
      purchase: purchaseview,
    });
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetPageViewParams, Result<BusinessPageViewPurchase>>(
    handler,
    buildTestEvent<GetPageViewParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getPageViewInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
          pageview_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
        },
      },
    }),
  );
}
