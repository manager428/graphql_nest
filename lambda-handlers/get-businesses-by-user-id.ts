import { StatusCodeError } from '../shared/statusCodes';
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
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { Business } from '@sirge-io/sirge-utils';
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
      name: 'get-businesses-by-user-id',
    },
  },
});

export type GetBusinessesByUserIdParams = {};

export const handler: AppSyncResolverHandler<
  GetBusinessesByUserIdParams,
  Result<{
    business_list: Business[];
    business_count: number;
    business_active_count: number;
  }>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);
    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser, isManager, managingUser } =
      await verifyUserSubscription(auth);

    if (!authenticatedUser?.user_id) {
      throw new StatusCodeError(2);
    }

    const user = isManager ? authenticatedUser : managingUser;

    const businesses = await getBusinessesByUserId(user?.user_id!);

    const business_active_count = businesses.filter(
      (item) => item.status === 'active',
    )?.length;

    logInfo(`Businesses returned: ${JSON.stringify(businesses)}`);

    return successResponse(
      {
        business_list: businesses,
        business_count: businesses?.length,
        business_active_count,
      },
      'Businesses returned.',
    );
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<
    GetBusinessesByUserIdParams,
    Result<{
      business_list: Business[];
      business_count: number;
      business_active_count: number;
    }>
  >(
    handler,
    buildTestEvent<GetBusinessesByUserIdParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
