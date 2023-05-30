import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessStatusByUserId,
  updateBusinessByName,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Result, SetBusinessParams } from '../shared/types';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { Business, BusinessStatus } from '@sirge-io/sirge-utils';
import * as Sentry from '@sentry/serverless';
import { getBusiness } from '../shared/mongoDb';

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
      name: 'update-business-by-businessid',
    },
  },
});

export const handler: AppSyncResolverHandler<
  SetBusinessParams,
  Result<Business>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);
    const auth = event.identity as AppSyncIdentityCognito;
    const { authenticatedUser: user } = await verifyUserSubscription(auth);
    if (!user) {
      throw new StatusCodeError(185);
    }
    const {
      setBusinessesInput: { business_id, business_name },
    } = event.arguments as SetBusinessParams;

    const business = await getBusiness(business_id);
    if (!business) {
      throw new StatusCodeError(1);
    }

    const updateBusiness = await updateBusinessByName(
      business_id,
      business_name,
    );

    logInfo(`Business returned: ${JSON.stringify(updateBusiness)}`);

    return successResponse(updateBusiness);
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<SetBusinessParams, Result<Business>>(
    handler,
    buildTestEvent<SetBusinessParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        setBusinessesInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
          business_name: 'Lex-Enterprise',
        },
      },
    }),
  );
}
