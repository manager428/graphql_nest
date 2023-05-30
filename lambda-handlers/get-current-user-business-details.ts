import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessesByUserId,
  getBusinessByVanityName,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import {
  CurrentUserBusinessDetails,
  getCurrentUserBusinessParams,
  Result,
} from '../shared/types';
import * as utils from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import * as Sentry from '@sentry/serverless';
import { getPageViewStatus } from '../shared/postgresDb';

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
      name: 'get-current-user-business-details',
    },
  },
});

export const handler: AppSyncResolverHandler<
  getCurrentUserBusinessParams,
  Result<CurrentUserBusinessDetails>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { vanity_name } = event.arguments.getCurrentUserBusinessDetailsInput;

    const data: CurrentUserBusinessDetails = {
      businesses: {
        business_active_count: 0,
        business_count: 0,
        business_list: [],
      },
      business: undefined,
      status: { active: false },
    };

    /**
     * vanity name could be undefined, in that case the resolver returns only de user businesess
     */
    if (vanity_name) {
      const business = await getBusinessByVanityName(vanity_name);

      if (business) {
        const activeStatus = await getPageViewStatus(business.business_id);

        data.business = business;
        data.status.active = activeStatus;
      }
    }

    /**
     * get businesess
     */
    const businesses = await getBusinessesByUserId(user?.user_id!);

    const business_active_count = businesses.filter(
      (item) => item.status === 'active',
    )?.length;

    data.businesses = {
      business_active_count,
      business_count: businesses.length,
      business_list: businesses,
    };

    return successResponse(data, 'Details successfully fetched');
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<
    getCurrentUserBusinessParams,
    Result<CurrentUserBusinessDetails>
  >(
    handler,
    buildTestEvent<getCurrentUserBusinessParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getCurrentUserBusinessDetailsInput: {
          vanity_name: '',
        },
      },
    }),
  );
}
