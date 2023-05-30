import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessStatusByUserId,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { BusinessStatus } from '@sirge-io/sirge-utils';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import {
  Result,
  GetBusinessParams,
  BusinessActiveStatus,
} from '../shared/types';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getPageViewStatus } from '../shared/postgresDb';
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
      name: 'get-business-trackerstatus',
    },
  },
});

export type GetBusinessTrackerStatusParams = {};

export const handler: AppSyncResolverHandler<
  GetBusinessTrackerStatusParams,
  Result<BusinessActiveStatus>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const {
      getBusinessesInput: { business_id },
    } = event.arguments as GetBusinessParams;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    await getBusinessStatusByUserId({
      business_id,
      user_id: user?.user_id,
      status: BusinessStatus.ACTIVE,
    });

    const activeStatus = await getPageViewStatus(business_id);

    return successResponse<BusinessActiveStatus>({ active: activeStatus });
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetBusinessTrackerStatusParams, Result<BusinessActiveStatus>>(
    handler,
    buildTestEvent<GetBusinessTrackerStatusParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getBusinessesInput: {
          business_id: 'ef6a00fd-49f0-47b2-a83a-922d9ef43c7d',
        },
      },
    }),
  );
}
