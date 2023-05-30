import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  verifyUserSubscription,
  checkBusiness,
  getVisitorsOfBusiness,
} from '../shared/dynamoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { Result } from '../shared/types';
import * as Sentry from '@sentry/serverless';
import { type } from 'os';

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
      name: 'get-all-visitors',
    },
  },
});

export type SortType = 'asc' | 'desc';

export type FieldSortType = 'purchases_count' | 'clicks_count' | 'last_visited';

export type SortObjectType = {
  sort: SortType;
  field: string;
};
export type FilterObjectType = {
  field: string;
  operator: string;
  value: string;
};

export type VisitorDetail = {
  id: string;
  visitor_email: string;
  country: string;
  state: string;
  city: string;
  total_pageviews: string;
  first_visit: string;
  total_purchases: string;
  total_purchase_conversion_value: string;
  total_records: string;
};

export type VisitorsAggregate = {
  visitor_id: string;
  date: string;
  source: string;
  last_visited: string;
  referer: string;
  visitor_name: string;
  purchases_count: string;
  conversion_value: string;
  clicks_count: string;
};

export type VisitorsAggregateData = {
  all_visitors: VisitorsAggregate[];
  total_records: number;
};

export interface GetVisitorsOfBusinessResponse {
  visitors: VisitorDetail[];
  lastEvaluatedKey?: AWS.DynamoDB.DocumentClient.Key;
}

export type GetAllVisitorsByBusinessDynamoParams = {
  getAllVisitorsDynamoInput: {
    business_id: string;
    page: number;
    sort?: SortObjectType;
  };
};

export const handler: AppSyncResolverHandler<
  GetAllVisitorsByBusinessDynamoParams,
  Result<any>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    if (!authenticatedUser?.subscription.status) {
      throw new StatusCodeError(88);
    }

    const {
      getAllVisitorsDynamoInput: { business_id, page, sort },
    } = event.arguments as GetAllVisitorsByBusinessDynamoParams;

    const business = await checkBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(1);
    }

    let { visitors, totalCount } = await getVisitorsOfBusiness(
      business.business_id,
      page,
      sort,
    );

    logInfo(`Business Visitor returned: ${JSON.stringify(visitors)}`);
    return successResponse(visitors, 'Business Visitor returned', totalCount);
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<
    GetAllVisitorsByBusinessDynamoParams,
    Result<GetVisitorsOfBusinessResponse[]>
  >(
    handler,
    buildTestEvent<GetAllVisitorsByBusinessDynamoParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getAllVisitorsDynamoInput: {
          business_id: '6f45bcf3-e336-4195-9e52-43c4c9a6ad35',
          page: 1,
          sort: {
            field: 'purchases_count',
            sort: 'desc',
          },
        },
      },
    }),
  );
}
