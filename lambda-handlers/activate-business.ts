import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  countBusinessByStatus,
  getBusinessStatusByUserId,
  updateBusinessStatus,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { BusinessStatus } from '@sirge-io/sirge-utils';
import { ActivateBusinessParams, Result } from '../shared/types';

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
      name: 'activate_business',
    },
  },
});

export const handler: AppSyncResolverHandler<
  ActivateBusinessParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { business_id } = event?.arguments?.activateBusinessInput;

    const { user_id, user_plan: plan } = user;

    const business = await getBusinessStatusByUserId({
      business_id,
      user_id,
      status: BusinessStatus.DEACTIVATED,
    });

    if (!business) {
      throw new Error('Business not found or already active.');
    }

    const { businessCount } = await countBusinessByStatus({
      user_id,
      status: BusinessStatus.ACTIVE,
    });

    const businessLimit = plan?.business_limit;

    if (businessCount + 1 > businessLimit) {
      throw new Error('Business limit already reached.');
    }

    const params = {
      user_id,
      business_id,
      status: BusinessStatus.ACTIVE,
    };

    const { message } = await updateBusinessStatus(params);

    logInfo({ message, businessCount });

    return successResponse(null, message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<ActivateBusinessParams, Result<null>>(
    handler,
    buildTestEvent<ActivateBusinessParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Managers',
      requestPayload: {
        activateBusinessInput: {
          business_id: '8c6479b1-3778-4994-ba1e-39ebe93b73ad',
        },
      },
    }),
  );
}
