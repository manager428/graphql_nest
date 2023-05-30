import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getAllPerformanceData,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { GetBusinessPerformanceParams, Result } from '../shared/types';
import { Performance } from '@sirge-io/sirge-types';
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
      name: 'get_performance_details',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetBusinessPerformanceParams,
  Result<Performance[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser, managingUser, isManager } =
      await verifyUserSubscription(auth);

    const {
      business_id,
      itemType,
      source,
      selected_campaigns,
      selected_ad_sets,
      sort,
      filterCondition,
      numberOfPage,
      dateStart,
      dateEnd,
    } = event?.arguments?.getPerformanceDetailsInput;

    const user = isManager ? authenticatedUser : managingUser;

    if (!user) {
      throw new StatusCodeError(185);
    }

    if (selected_campaigns && selected_campaigns.includes('')) {
      throw new StatusCodeError(120);
    }

    if (selected_ad_sets && selected_ad_sets.includes('')) {
      throw new StatusCodeError(128);
    }

    const isTypeOfSelectedArray: string | null = selected_campaigns
      ? 'selected_campaigns'
      : selected_ad_sets
        ? 'selected_ad_sets'
        : null;

    const selected_array: string[] | undefined =
      isTypeOfSelectedArray === 'selected_campaigns'
        ? selected_campaigns
        : selected_ad_sets;

    const { numberPages, performance } = await getAllPerformanceData(
      business_id,
      itemType,
      isTypeOfSelectedArray,
      source,
      selected_array,
      sort,
      filterCondition,
      numberOfPage,
      dateStart,
      dateEnd,
    );
    
    return successResponse(
      performance,
      'Performance data fetched successfully.',
      numberPages,
      // summary,
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetBusinessPerformanceParams, Result<Performance[]>>(
    handler,
    buildTestEvent<GetBusinessPerformanceParams>({
      userId: 'dd941e62-1261-4e6c-bf5e-ab50a6b12de1',
      group: 'Managers',
      requestPayload: {
        getPerformanceDetailsInput: {
          business_id: 'c7a5cb5d-d0da-48db-8b28-c0a954074ebf',
          itemType: 'Campaign',
          dateStart: '2023-03-01 12:58:22 -0400',
          dateEnd: '2023-03-10 12:58:22 -0400',
        },
      },
    }),
  );
}
