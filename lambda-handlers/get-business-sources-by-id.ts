import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Result, SourcesSortObjectType } from '../shared/types';
import { PageView } from '@sirge-io/sirge-utils';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getBusinessSourcesById } from '../shared/mongoDb';
import * as Sentry from '@sentry/serverless';
import { getBusinessSourcesByBusinessId } from '../shared/postgresDb';

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
      name: 'get-business-sources-by-id',
    },
  },
});

export type GetBusinessSourcesByIdInput = {
  business_id: string;
  date_from?: string;
  date_to?: string;
  sort?: SourcesSortObjectType;
  numberOfPage?: number;
};

export type GetBusinessSourcesParams = {
  getBusinessSourcesByIdInput: GetBusinessSourcesByIdInput;
};

export const handler: AppSyncResolverHandler<
  GetBusinessSourcesParams,
  Result<PageView[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    const { business_id, date_from, date_to, sort, numberOfPage } = event
      .arguments.getBusinessSourcesByIdInput as GetBusinessSourcesByIdInput;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    if (!authenticatedUser?.subscription?.status) {
      throw new StatusCodeError(88);
    }

    const { sources, numberPages } = await getBusinessSourcesById(
      business_id,
      date_from,
      date_to,
      numberOfPage,
      sort,
    );

    console.log(sources);

    return successResponse(sources, 'Sources Returned', numberPages);
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<GetBusinessSourcesParams, Result<PageView[]>>(
    handler,
    buildTestEvent<GetBusinessSourcesParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getBusinessSourcesByIdInput: {
          business_id: '6f45bcf3-e336-4195-9e52-43c4c9a6ad35',
          date_from: '2023-02-23 12:58:22 -0400',
          date_to: '2023-03-23 12:58:22 -0400',
          // sort: {
          //   field: 'source',
          //   sort: 'asc',
          // },
          // numberOfPage: 1,
        },
      },
    }),
  );
}
