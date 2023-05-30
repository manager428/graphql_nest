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
import { getVisitorDetailSources } from '../shared/postgresDb';
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
      name: 'get-visitor-detail-sources',
    },
  },
});

export type GetVisitorDetailSourcesParams = {
  getVisitorDetailSourcesInput: {
    business_id: string;
    visitor_id: string;
    page: number;
  };
};

export const handler: AppSyncResolverHandler<
  GetVisitorDetailSourcesParams,
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
      getVisitorDetailSourcesInput: { business_id, visitor_id, page },
    } = event.arguments as GetVisitorDetailSourcesParams;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await checkBusiness(business_id);

    const visitor_pageviews = await getVisitorDetailSources(
      business.business_id,
      visitor_id,
      page * 10,
    );

    logInfo(`Business Visitor returned: ${JSON.stringify(visitor_pageviews)}`);

    return successResponse(visitor_pageviews, 'Business Visitor returned');
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<GetVisitorDetailSourcesParams, Result<PageView[]>>(
    handler,
    buildTestEvent<GetVisitorDetailSourcesParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getVisitorDetailSourcesInput: {
          business_id: '6f45bcf3-e336-4195-9e52-43c4c9a6ad35',
          visitor_id: '0388e82f-3202-4bcf-90eb-2e8634c234ba',
          page: 0,
        },
      },
    }),
  );
}
