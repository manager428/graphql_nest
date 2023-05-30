import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusiness,
  getBusinessAnalytics,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { GetBusinessAnalyticsParams, Result } from '../shared/types';
import { Business, Analytics } from '@sirge-io/sirge-types';
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
      name: 'get-business-analytics',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetBusinessAnalyticsParams,
  Result<Analytics>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser, managingUser, isManager } =
      await verifyUserSubscription(auth);

    const { business_id } = event?.arguments?.getBusinessAnalyticsInput;

    const user = isManager ? authenticatedUser : managingUser;

    if (!user) {
      throw new StatusCodeError(185);
    }

    const business: Business = await getBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(3);
    }

    const analytics: Analytics | null = await getBusinessAnalytics(business_id);

    return successResponse(
      analytics,
      'Business analytics data fetched successfully.',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetBusinessAnalyticsParams, Result<Analytics>>(
    handler,
    buildTestEvent<GetBusinessAnalyticsParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getBusinessAnalyticsInput: {
          business_id: '6f45bcf3-e336-4195-9e52-43c4c9a6ad35',
        },
      },
    }),
  );
}
