import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  verifyUserSubscription,
  checkBusiness,
  getVisitorsOfBusinessGraph,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { Result } from '../shared/types';
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
      name: 'get-all-visitors-graph-mongo',
    },
  },
});

export type GetAllVisitorsByBusinessGraphParams = {
  getAllVisitorsGraphInput: {
    business_id: string;
  };
};

export type AllBusinessVisitorGraph = {
  date: string;
  new_visitors: string;
  returning_visitors: string;
};

export const handler: AppSyncResolverHandler<
  GetAllVisitorsByBusinessGraphParams,
  Result<any[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    if (!authenticatedUser?.subscription.status) {
      throw new StatusCodeError(88);
    }

    const {
      getAllVisitorsGraphInput: { business_id },
    } = event.arguments as GetAllVisitorsByBusinessGraphParams;

    const business = await checkBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(1);
    }
    const all_visitors = await getVisitorsOfBusinessGraph(business_id);

    logInfo(`Business Visitor returned: ${JSON.stringify(all_visitors)}`);

    return successResponse(all_visitors, 'Business Visitor returned');
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<
    GetAllVisitorsByBusinessGraphParams,
    Result<AllBusinessVisitorGraph[]>
  >(
    handler,
    buildTestEvent<GetAllVisitorsByBusinessGraphParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getAllVisitorsGraphInput: {
          business_id: 'c93a4d96-8e7b-4da3-bd81-1c1a3d55b966',
        },
      },
    }),
  );
}
