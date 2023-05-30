import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  countBusinessByStatus,
  getBusinessStatusByUserId,
  updateBusinessStatus,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { BusinessStatus } from '@sirge-io/sirge-utils';
import { DeactivateBusinessParams, Result } from '../shared/types';

import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
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
      name: 'deactivate-business',
    },
  },
});

export const handler: AppSyncResolverHandler<
  DeactivateBusinessParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { business_id } = event?.arguments?.deactivateBusinessInput;

    const { user_id, user_plan: plan } = user;

    const business = await getBusinessStatusByUserId({
      business_id,
      user_id,
      status: BusinessStatus.ACTIVE,
    });

    if (!business) {
      throw new Error('Business not found or already deactivated.');
    }

    const params = {
      user_id,
      business_id,
      status: BusinessStatus.DEACTIVATED,
    };

    const { message } = await updateBusinessStatus(params);

    logInfo({ message });

    return successResponse(null, message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<DeactivateBusinessParams, Result<null>>(
    handler,
    buildTestEvent<DeactivateBusinessParams>({
      userId: '7634d519-1e12-4bde-827f-b591accfaa61',
      group: 'Managers',
      requestPayload: {
        deactivateBusinessInput: {
          business_id: 'be3d0aa2-2108-4fbd-87d5-fa1d1d296c21',
        },
      },
    }),
  );
}
