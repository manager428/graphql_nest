import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessesByUserId,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Result } from '../shared/types';
import { Usage, Business, PageViewCount } from '@sirge-io/sirge-utils';
import { logInfo } from '../shared/utils';
import { getPageViews } from '../shared/postgresDb';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { startOfDay } from '../shared/time';
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
      name: 'get-usage',
    },
  },
});

export type GetUsageParams = {};

export const handler: AppSyncResolverHandler<
  GetUsageParams,
  Result<Usage>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const {
      authenticatedUser: user,
      managingUser,
      isManager,
      isStaff,
    } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const subscription = isManager
      ? user?.subscription
      : isStaff
      ? managingUser?.subscription
      : (() => {
          throw new StatusCodeError(29);
        })();

    const currentBillingPeriodStart = new Date(
      Number(subscription?.current_billing_period_start) * 1000,
    );
    const currentBillingPeriodEnd = new Date(
      Number(subscription?.current_billing_period_end) * 1000,
    );

    const dateStart = startOfDay(
      currentBillingPeriodStart,
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
      undefined,
      true,
    );

    const dateEnd = startOfDay(
      currentBillingPeriodEnd,
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
      undefined,
      true,
    );

    const userId = isManager ? user?.user_id : managingUser?.user_id;

    // get business IDs
    const businessIds = (await getBusinessesByUserId(userId as string))
      .map((business: Business) => `'${business.business_id}'`)
      .join(',');

    const [{ count: totalUsage = 0 }] = (await getPageViews(
      {
        businessIds,
        dateEnd,
        dateStart,
      },
      true,
    )) as PageViewCount[];

    return successResponse<Usage>(
      { total_usage: Number(totalUsage) },
      'Usage fetched successfully',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetUsageParams, Result<Usage>>(
    handler,
    buildTestEvent<GetUsageParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
