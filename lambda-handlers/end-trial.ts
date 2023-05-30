import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById, updateUserEndTrialSource } from '../shared/mongoDb';
import { Result } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
import { updateStripeSubscription } from '../shared/stripe';
import { checkSubscriptionStatus } from '../shared/checkSubscriptionStatus';
import { SubscriptionStatuses } from '@sirge-io/sirge-utils';
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
      name: 'end-trial',
    },
  },
});

export type EndTrialParams = {};

export const handler: AppSyncResolverHandler<
  EndTrialParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const user = await getUserById(auth?.sub);

    if (!user) {
      throw new StatusCodeError(185);
    }

    checkSubscriptionStatus(user);

    const { user_id, subscription } = user;

    const subscriptionBody = Buffer.from(
      subscription.subscription_body,
      'base64',
    ).toString();

    const decode = JSON.parse(subscriptionBody);

    if (decode.status !== SubscriptionStatuses.TRIALING) {
      throw new StatusCodeError(106);
    }

    const userSubscription = await updateStripeSubscription(
      user?.subscription?.id,
      {
        trial_end: 'now',
      },
    );

    const { message } = await updateUserEndTrialSource(
      'end trial button clicked - billing',
      user_id,
    );

    return successResponse(null, message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<EndTrialParams, Result<null>>(
    handler,
    buildTestEvent<EndTrialParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
