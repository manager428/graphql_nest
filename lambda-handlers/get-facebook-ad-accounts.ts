import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateUserFacebookAccessDetails,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { FacebookAdAccount, Result } from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import { logError, logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getFacebookAdAccounts } from '../shared/facebook';
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
      name: 'get-facebook-ad-accounts',
    },
  },
});

export type GetFacebookAdAccountsParams = {};

export const handler: AppSyncResolverHandler<
  GetFacebookAdAccountsParams,
  Result<FacebookAdAccount[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const {
      authenticatedUser: user,
      managingUser,
      isManager,
    } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const facebookAccessConfig = {
      facebookAccessToken: isManager
        ? user.facebook_accessToken
        : managingUser?.facebook_accessToken,
      facebookUserId: isManager
        ? user.facebook_userID
        : managingUser?.facebook_userID,
    };

    if (!facebookAccessConfig.facebookAccessToken) {
      throw new StatusCodeError(59);
    }

    const response = await getFacebookAdAccounts(
      facebookAccessConfig.facebookUserId || '',
      facebookAccessConfig.facebookAccessToken,
    );
    if (!response.ok) {
      throw new StatusCodeError(60);
    }

    const jsonResponse: { data: FacebookAdAccount[]; error: unknown } =
      await response.json();

    if (jsonResponse.error) {
      logError(jsonResponse.error, 'Facebook api failed');
      await updateUserFacebookAccessDetails({
        user: isManager ? user : (managingUser as User),
        facebook_userID: null,
        facebook_accessToken: null,
      });
    }

    return successResponse<FacebookAdAccount[]>(
      jsonResponse.data,
      'Facebook ad accounts fetched successfully',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetFacebookAdAccountsParams, Result<FacebookAdAccount[]>>(
    handler,
    buildTestEvent<GetFacebookAdAccountsParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
