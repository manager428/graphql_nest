import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateUserFacebookAccessDetails,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { User, FacebookIntegrationStatus } from '@sirge-io/sirge-utils';
import { Result } from '../shared/types';
import { logError, logInfo } from '../shared/utils';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError } from '../shared/statusCodes';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getFacebookAccount } from '../shared/facebook';
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
      name: 'get-account-integrations',
    },
  },
});

export type GetAccountIntegrationsParams = {};

interface FacebookAccessConfig {
  facebookIntegration: FacebookIntegrationStatus;
  facebookAccessToken?: string | null;
  facebookUserId?: string | null;
}

export type AccountIntegration = {
  facebook: FacebookIntegrationStatus;
};

export const handler: AppSyncResolverHandler<
  GetAccountIntegrationsParams,
  Result<AccountIntegration>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const {
      authenticatedUser: user,
      isManager,
      managingUser,
    } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const subscriptionId = isManager
      ? user.subscription.id
      : managingUser?.subscription.id;

    if (!subscriptionId) {
      throw new StatusCodeError(88);
    }

    const facebookAccessConfig: FacebookAccessConfig = {
      facebookIntegration: 'false',
      facebookAccessToken: isManager
        ? user.facebook_accessToken
        : managingUser?.facebook_accessToken,
      facebookUserId: isManager
        ? user.facebook_userID
        : managingUser?.facebook_userID,
    };

    if (facebookAccessConfig.facebookAccessToken) {
      const response = await getFacebookAccount(
        facebookAccessConfig.facebookAccessToken || '',
      );

      if (!response.ok) {
        facebookAccessConfig.facebookIntegration = 'expired';

        await updateUserFacebookAccessDetails({
          user: isManager ? user : (managingUser as User),
          facebook_userID: null,
          facebook_accessToken: null,
        });
      } else {
        facebookAccessConfig.facebookIntegration = 'true';
      }
    }

    logInfo(`User returned: ${JSON.stringify(user)}`);

    const accountIntegrations: AccountIntegration = {
      facebook: facebookAccessConfig.facebookIntegration,
    };

    return successResponse(accountIntegrations);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  try {
    enableDebugMode<GetAccountIntegrationsParams, Result<AccountIntegration>>(
      handler,
      buildTestEvent<GetAccountIntegrationsParams>({
        userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
        group: 'Staff',
        managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
        requestPayload: {},
      }),
    );
  } catch (e) {
    logError(e);
    process.exit(1);
  }
}
