import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateUserFacebookAccessDetails,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { User } from '@sirge-io/sirge-utils';
import { Result, FacebookAccessInput } from '../shared/types';
import { logError, logInfo } from '../shared/utils';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError } from '../shared/statusCodes';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { exchangeFacebookToken } from '../shared/facebook';
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
      name: 'set-facebook-user-access',
    },
  },
});

export type SetFacebookUserAccessParams = {
  facebookAccessInput: FacebookAccessInput;
};

export const handler: AppSyncResolverHandler<
  SetFacebookUserAccessParams,
  Result<null>
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

    const response = await exchangeFacebookToken(
      event.arguments.facebookAccessInput.facebook_accessToken,
    );

    const jsonResponse = await response.json();

    if (!response.ok) {
      logError(jsonResponse.error, 'Facebook api failed');
      throw new StatusCodeError(124);
    }

    await updateUserFacebookAccessDetails({
      user: isManager ? user : (managingUser as User),
      ...event.arguments.facebookAccessInput,
      facebook_accessToken: jsonResponse.access_token,
    });

    logInfo(`User returned: ${JSON.stringify(user)}`);

    return successResponse(null, 'Facebook user access set.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  try {
    enableDebugMode<SetFacebookUserAccessParams, Result<null>>(
      handler,
      buildTestEvent<SetFacebookUserAccessParams>({
        userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
        group: 'Managers',
        requestPayload: {
          facebookAccessInput: {
            facebook_accessToken:
              'EAACBw7i5ZAF0BABt8ua3HIDZB6G39GSfbScQdMmDOazUTtIOJzxcuNK6lQhXD4uMVkvjU9eeiaQCVX0rOpM41pS0i6ocksCaL3Qu8x71Y46miVbkiEUCdX7sHwf2d99Xteq1ZCfYHBlbiEvyT19uEDz3PBFlUZCyQiwqrAXOGPgDSS2eUhvIeteeNzva3FTitEdbescPSuyHcTejX57H',
            facebook_userID: '1646979539106118',
          },
        },
      }),
    );
  } catch (e) {
    logError(e);
    process.exit(1);
  }
}
