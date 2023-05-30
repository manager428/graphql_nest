import { Business, EventLog } from '@sirge-io/sirge-utils';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessesByUserId,
  getBusinessEventLogByBusinessIds,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { StatusCodeError } from '../shared/statusCodes';
import { successResponse } from '../shared/successResponse';
import {
  Result,
  EventLogUsage,
  GetEventLogUsageToDateByBusinessParams,
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
      name: 'get-usage-to-date-by-business',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetEventLogUsageToDateByBusinessParams,
  Result<EventLogUsage[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser, isStaff } = await verifyUserSubscription(auth);

    if (!authenticatedUser || isStaff) {
      throw new StatusCodeError(87);
    }

    // Get business ids
    const businesses = (
      await getBusinessesByUserId(authenticatedUser?.user_id)
    ).map((business: Business) => ({
      id: business.business_id,
      business_name: business.business_name,
    }));

    const businessNames: string[] = [];
    const businessValues: number[] = [];

    // Batch grab event logs
    const eventLogs = await getBusinessEventLogByBusinessIds(
      businesses.map((business) => `'${business.id}'`),
    );

    // Map results
    for (const [i, eventLog] of eventLogs.entries()) {
      if (eventLog.business_id === businesses[i].id) {
        businessNames.push(businesses[i].business_name as string);
        businessValues.push(
          eventLogs.filter((log) => log.business_id === businesses[i].id)
            .length,
        );
      }
    }

    const eventLogUsage: EventLogUsage[] = [
      {
        labels: businessNames,
        values: businessValues,
      },
    ];

    return successResponse(
      eventLogUsage,
      'Successfully pulled event logs to date.',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<
    GetEventLogUsageToDateByBusinessParams,
    Result<EventLogUsage[]>
  >(
    handler,
    buildTestEvent<GetEventLogUsageToDateByBusinessParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
