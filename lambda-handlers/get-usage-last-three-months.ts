import { Business } from '@sirge-io/sirge-utils';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessesByUserId,
  getBusinessEventLogByDateRange,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { StatusCodeError } from '../shared/statusCodes';
import { successResponse } from '../shared/successResponse';
import { getFormatDate } from '../shared/time';
import {
  Result,
  EventLogUsage,
  GetEventLogUsageLastThreeMonthsParams,
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
      name: 'get-usage-last-three-months',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetEventLogUsageLastThreeMonthsParams,
  Result<EventLogUsage[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser, isStaff } = await verifyUserSubscription(auth);

    if (!authenticatedUser || isStaff) {
      throw new StatusCodeError(87);
    }

    // Get businesses
    const businessIds = (
      await getBusinessesByUserId(authenticatedUser?.user_id)
    ).map((business: Business) => `'${business.business_id}'`);

    const date = new Date();

    // build dates
    const month1Start = new Date(
      date.getFullYear(),
      date.getMonth(),
      1,
    ).getTime();
    const month1End = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
    ).getTime();

    const month2Start = new Date(
      date.getFullYear(),
      date.getMonth() - 2,
      1,
    ).getTime();
    const month2End = new Date(
      date.getFullYear(),
      date.getMonth() - 1,
      0,
    ).getTime();

    const month3Start = new Date(
      date.getFullYear(),
      date.getMonth() - 3,
      1,
    ).getTime();
    const month3End = new Date(
      date.getFullYear(),
      date.getMonth() - 2,
      0,
    ).getTime();

    // gather data
    const pv1 = await getBusinessEventLogByDateRange(
      businessIds,
      month1Start,
      month1End,
    );
    const pv2 = await getBusinessEventLogByDateRange(
      businessIds,
      month2Start,
      month2End,
    );
    const pv3 = await getBusinessEventLogByDateRange(
      businessIds,
      month3Start,
      month3End,
    );

    const eventLog: EventLogUsage[] = [
      {
        labels: [
          getFormatDate(new Date(month1Start), {
            month: 'long',
          }),
          getFormatDate(new Date(month2Start), {
            month: 'long',
          }),
          getFormatDate(new Date(month3Start), {
            month: 'long',
          }),
        ],
        values: [pv3.length, pv2.length, pv1.length],
      },
    ];

    return successResponse(
      eventLog,
      'Successfully pulled last three months of event logs.',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<
    GetEventLogUsageLastThreeMonthsParams,
    Result<EventLogUsage[]>
  >(
    handler,
    buildTestEvent<GetEventLogUsageLastThreeMonthsParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
