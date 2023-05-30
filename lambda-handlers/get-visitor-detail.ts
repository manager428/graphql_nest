import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { verifyUserSubscription, checkBusiness } from '../shared/dynamoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { PageView } from '@sirge-io/sirge-utils';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getVisitorDetailOfBusiness } from '../shared/postgresDb';
import { getFormatDate } from '../shared/time';
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
      name: 'get-visitor-detail',
    },
  },
});

export type GetVisitorDetailByBusinessParams = {
  getVisitorDetailInput: {
    business_id: string;
    visitor_id: string;
  };
};

export const handler: AppSyncResolverHandler<
  GetVisitorDetailByBusinessParams,
  Result<PageView[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    if (!authenticatedUser?.subscription.status) {
      throw new StatusCodeError(88);
    }

    const {
      getVisitorDetailInput: { business_id, visitor_id },
    } = event.arguments as GetVisitorDetailByBusinessParams;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await checkBusiness(business_id);

    const all_visitors = await getVisitorDetailOfBusiness(
      business.business_id,
      visitor_id,
    );

    logInfo(`Business Visitor returned: ${JSON.stringify(all_visitors)}`);

    return successResponse(all_visitors, 'Business Visitor returned');
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<GetVisitorDetailByBusinessParams, Result<PageView[]>>(
    handler,
    buildTestEvent<GetVisitorDetailByBusinessParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getVisitorDetailInput: {
          business_id: '6f45bcf3-e336-4195-9e52-43c4c9a6ad35',
          visitor_id: '4cc8a4ed-18af-41c6-b98e-6f253186a8ea',
        },
      },
    }),
  );
}
