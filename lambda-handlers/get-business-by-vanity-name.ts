import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessByVanityName,
  getUserBusinessByVanityName,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { Business } from '@sirge-io/sirge-utils';
import { GetBusinessByVanityNameParams, Result } from '../shared/types';
import { logInfo } from '../shared/utils';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import * as Sentry from '@sentry/serverless';
import { StatusCodeError } from '../shared/statusCodes';

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
      name: 'get-business-by-vanity-name',
    },
  },
});

export const handler: AppSyncResolverHandler<
  GetBusinessByVanityNameParams,
  Result<Business>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;
    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new Error('No authenticated user');
    }
    const { vanity_name } = event?.arguments?.getBusinessByVanityNameInput;

    const businessCheck = await getBusinessByVanityName(vanity_name);

    if (!businessCheck) {
      throw new StatusCodeError(1);
    }

    return successResponse(businessCheck);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetBusinessByVanityNameParams, Result<Business>>(
    handler,
    buildTestEvent<GetBusinessByVanityNameParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        getBusinessByVanityNameInput: {
          vanity_name: 'lex-inc',
        },
      },
    }),
  );
}
