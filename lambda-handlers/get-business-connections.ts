import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessConnection,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Result } from '../shared/types';
import { BusinessConnections } from '@sirge-io/sirge-utils';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
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
      name: 'get-business-connections',
    },
  },
});

export type GetBusinessConnectionsParams = {
  getBusinessConnectionsInput: {
    business_id: string;
  };
};

export const handler: AppSyncResolverHandler<
  GetBusinessConnectionsParams,
  Result<BusinessConnections>
> = async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    const { business_id } = event.arguments.getBusinessConnectionsInput;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    if (!authenticatedUser?.subscription) {
      throw new StatusCodeError(88);
    }

    const business_connections = await getBusinessConnection(business_id);

    return successResponse(business_connections, 'Connections Returned');
  } catch (error) {
    return errorResponse(error, event);
  }
};

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<GetBusinessConnectionsParams, Result<BusinessConnections>>(
    handler,
    buildTestEvent<GetBusinessConnectionsParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        getBusinessConnectionsInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
        },
      },
    }),
  );
}
