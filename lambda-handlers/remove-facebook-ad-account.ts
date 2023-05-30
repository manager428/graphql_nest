import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusiness,
  setFacebookAdAccountInfo,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { Result } from '../shared/types';
import { logError, logInfo } from '../shared/utils';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError, statusCodes } from '../shared/statusCodes';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { checkSubscriptionStatus } from '../shared/checkSubscriptionStatus';
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
      name: 'remove-facebook-ad-account',
    },
  },
});

export type RemoveFacebookAdAccountParams = {
  removeFacebookAdAccountInput: {
    business_id: string;
  };
};

export const handler: AppSyncResolverHandler<
  RemoveFacebookAdAccountParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    checkSubscriptionStatus(user);

    const business_id =
      event.arguments.removeFacebookAdAccountInput.business_id;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await getBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(0);
    }

    //defaults to null out fields if they are not provided
    await setFacebookAdAccountInfo({ business_id });

    return successResponse(null, statusCodes[62].message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  try {
    enableDebugMode<RemoveFacebookAdAccountParams, Result<null>>(
      handler,
      buildTestEvent<RemoveFacebookAdAccountParams>({
        userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
        group: 'Managers',
        managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
        requestPayload: {
          removeFacebookAdAccountInput: {
            business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
          },
        },
      }),
    );
  } catch (e) {
    logError(e);
    process.exit(1);
  }
}
