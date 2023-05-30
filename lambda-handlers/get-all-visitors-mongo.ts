import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  verifyUserSubscription,
  checkBusiness,
  getVisitorsOfBusiness,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { PageView } from '@sirge-io/sirge-utils';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
// import { getVisitorsOfBusiness } from '../shared/postgresDb';
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
  value: string | number;
};

export type GetAllVisitorsByBusinessParams = {
  business_id: string;
  date_from: string;
  date_to: string;
  page: number;
  number_of_records: number;
  sort?: SortObjectType;
  filter?: FilterObjectType[];
};

export type AllBusinessVisitor = {
  clicks_count: string;
  conversion_value: string;
  date: string;
  last_visited: string;
  purchases_count: string;
  referer: string;
  source: string;
  visitor_id: string;
  visitor_name: string;
};

export type GetAllVisitorResponse = {
  data: AllBusinessVisitor[];
  totalRecords: number;
};

export const handler: AppSyncResolverHandler<
  GetAllVisitorsByBusinessParams,
  Result<GetAllVisitorResponse>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    if (!authenticatedUser?.subscription.status) {
      throw new StatusCodeError(88);
    }

    const {
      business_id,
      date_from,
      date_to,
      page,
      sort,
      number_of_records,
      filter,
    } = event.arguments as GetAllVisitorsByBusinessParams;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await checkBusiness(business_id);

    // let format_date_from = getFormatDate(date_from as string, {
    //   year: 'numeric',
    //   month: '2-digit',
    //   day: '2-digit',
    // });

    // let format_date_to = getFormatDate(date_to as string, {
    //   year: 'numeric',
    //   month: '2-digit',
    //   day: '2-digit',
    // });

    const all_visitors = await getVisitorsOfBusiness(
      business.business_id,
      date_from,
      date_to,
      page * number_of_records,
      number_of_records,
      sort,
      filter,
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
  enableDebugMode<
    GetAllVisitorsByBusinessParams,
    Result<GetAllVisitorResponse>
  >(
    handler,
    buildTestEvent<GetAllVisitorsByBusinessParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        business_id: 'c93a4d96-8e7b-4da3-bd81-1c1a3d55b966',
        date_from: '2021-06-04',
        date_to: '2023-21-03',
        page: 1,
        number_of_records: 10,
        sort: {
          field: 'purchases_count',
          sort: 'asc',
        },
        filter: [
          {
            field: 'purchases_count',
            operator: '>',
            value: 0,
          },
        ],
      },
    }),
  );
}
