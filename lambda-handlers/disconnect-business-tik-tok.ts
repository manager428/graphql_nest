import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  disconnectBussinesTikTokAccount,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Business } from '@sirge-io/sirge-utils';
import { Result, DisconnectBusinessTikTokParams } from '../shared/types';

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
      name: 'disconnect-business-tik-tok',
    },
  },
});

export const handler: AppSyncResolverHandler<
  DisconnectBusinessTikTokParams,
  Result<Business>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser, isManager } = await verifyUserSubscription(auth);

    if (!isManager) {
      throw new StatusCodeError(76);
    }

    if (!authenticatedUser?.tik_tok_access_token) {
      throw new StatusCodeError(186);
    }

    const {
      disconnectBusinessTiktokInput: { business_id },
    } = event.arguments as DisconnectBusinessTikTokParams;

    const business = await disconnectBussinesTikTokAccount(business_id);

    return successResponse(business, 'Ad account disconnected.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<DisconnectBusinessTikTokParams, Result<Business>>(
    handler,
    buildTestEvent<DisconnectBusinessTikTokParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        disconnectBusinessTiktokInput: {
          business_id: 'ef6a00fd-49f0-47b2-a83a-922d9ef43c7d',
        },
      },
    }),
  );
}
