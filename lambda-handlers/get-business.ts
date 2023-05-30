import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getBusiness, verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { GetBusinessParams, Result } from '../shared/types';
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
      name: 'get-business',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetBusinessParams,
  Result<Business>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    await verifyUserSubscription(auth);

    const {
      getBusinessesInput: { business_id },
    } = event.arguments as GetBusinessParams;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await getBusiness(business_id);

    logInfo(`Business returned: ${JSON.stringify(business)}`);

    return successResponse(business);
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<GetBusinessParams, Result<Business>>(
    handler,
    buildTestEvent<GetBusinessParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getBusinessesInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
        },
      },
    }),
  );
}
