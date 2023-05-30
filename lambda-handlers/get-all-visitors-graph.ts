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
import { getVisitorsOfBusinessGraph } from '../shared/postgresDb';
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
      name: 'get-all-visitors-graph',
    },
  },
});

export type GetAllVisitorsByBusinessGraphParams = {
  getAllVisitorsGraphInput: {
    business_id: string;
    date_from: string;
    date_to: string;
  };
};

export const handler: AppSyncResolverHandler<
  GetAllVisitorsByBusinessGraphParams,
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
      getAllVisitorsGraphInput: { business_id, date_from, date_to },
    } = event.arguments as GetAllVisitorsByBusinessGraphParams;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await checkBusiness(business_id);
    let format_date_from = getFormatDate(date_from as string, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    let format_date_to = getFormatDate(date_to as string, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const all_visitors = await getVisitorsOfBusinessGraph(
      business.business_id,
      format_date_from,
      format_date_to,
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
  enableDebugMode<GetAllVisitorsByBusinessGraphParams, Result<PageView[]>>(
    handler,
    buildTestEvent<GetAllVisitorsByBusinessGraphParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getAllVisitorsGraphInput: {
          business_id: '6f45bcf3-e336-4195-9e52-43c4c9a6ad35',
          date_from: '2021-06-04',
          date_to: '2023-01-28',
        },
      },
    }),
  );
}
