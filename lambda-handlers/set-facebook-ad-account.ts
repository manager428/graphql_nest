import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusiness,
  setFacebookAdAccountInfo,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { Result } from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import { logError, logInfo } from '../shared/utils';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError, statusCodes } from '../shared/statusCodes';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { checkSubscriptionStatus } from '../shared/checkSubscriptionStatus';
import { getFacebookAdsPixels, setFacebookAdAccount } from '../shared/facebook';
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
      name: 'set-facebook-ad-account',
    },
  },
});

export type SetFacebookAdAccountParams = {
  setFacebookAdAccountInput: {
    business_id: string;
    facebook_ad_account_id: string;
    facebook_ad_account_name: string;
    facebook_ad_account_currency: string;
  };
};

export const handler: AppSyncResolverHandler<
  SetFacebookAdAccountParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const {
      authenticatedUser: au,
      managingUser: mu,
      isManager,
    } = await verifyUserSubscription(auth);

    const user = isManager ? au : (mu as User);

    if (!user) {
      throw new StatusCodeError(185);
    }

    if (!user.facebook_accessToken) {
      throw new StatusCodeError(59);
    }

    checkSubscriptionStatus(user);

    const business_id = event.arguments.setFacebookAdAccountInput.business_id;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await getBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(0);
    }

    const {
      facebook_ad_account_id,
      facebook_ad_account_name,
      facebook_ad_account_currency,
    } = event.arguments.setFacebookAdAccountInput;

    const response = await setFacebookAdAccount(
      facebook_ad_account_id,
      user.facebook_accessToken,
    );

    if (response?.error || !response?.timezone_name) {
      throw new StatusCodeError(68);
    }

    const pixelIdsResponse = await getFacebookAdsPixels(
      facebook_ad_account_id,
      user.facebook_accessToken,
    );

    if (!pixelIdsResponse.ok) {
      throw new StatusCodeError(60);
    }

    const jsonResponse: {
      data: { name: string; id: string }[];
      error: unknown;
    } = await pixelIdsResponse.json();

    const fb_pixel_id =
      jsonResponse.data.length > 0 ? jsonResponse.data[0].id : null;

    //defaults to null out fields if they are not provided
    await setFacebookAdAccountInfo({
      business_id,
      fb_pixel_id,
      facebook_ad_account_id,
      facebook_ad_account_currency,
      facebook_ad_account_name,
      facebook_ad_account_timezone: response.timezone_name,
    });

    return successResponse(null, statusCodes[61].message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  try {
    enableDebugMode<SetFacebookAdAccountParams, Result<null>>(
      handler,
      buildTestEvent<SetFacebookAdAccountParams>({
        userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
        group: 'Managers',
        managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
        requestPayload: {
          setFacebookAdAccountInput: {
            business_id: 'c93a4d96-8e7b-4da3-bd81-1c1a3d55b966',
            facebook_ad_account_id: 'act_291279251656676',
            facebook_ad_account_name: 'Greatness',
            facebook_ad_account_currency: 'USD',
          },
        },
      }),
    );
  } catch (e) {
    logError(e);
    process.exit(1);
  }
}
