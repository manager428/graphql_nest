import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { Result } from '../shared/types';
import { logInfo } from '../shared/utils';
import { updateFacebookAdStatus } from '../shared/facebook';
import { FacebookAdStatuses } from '../shared/enums/facebookAdStatuses';
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
      name: 'update-facebook-ad-status',
    },
  },
});

type UpdateFacebookAdStatusInput = {
  adId: string;
  status: FacebookAdStatuses;
};

export type UpdateFacebookAdStatusParams = {
  updateFacebookAdStatusInput: UpdateFacebookAdStatusInput;
};

export const handler: AppSyncResolverHandler<
  UpdateFacebookAdStatusParams,
  Result<boolean>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser, isManager, managingUser } =
      await verifyUserSubscription(auth);

    const user = isManager ? authenticatedUser : managingUser;

    if (!authenticatedUser || !user) {
      throw new StatusCodeError(185);
    }

    const { adId, status } = event.arguments.updateFacebookAdStatusInput;

    if (!user.facebook_accessToken) {
      throw new StatusCodeError(59);
    }

    const updateStatus = await updateFacebookAdStatus(
      adId,
      status,
      user.facebook_accessToken,
    );

    return successResponse(updateStatus, 'Facebook ad status updated');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});
