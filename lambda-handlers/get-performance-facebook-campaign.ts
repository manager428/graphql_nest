import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  checkBusiness,
  getUserAccountIntegrationData,
  updateUserFacebookAccessDetails,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';

import * as utils from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
import { getFacebookAdAccountCampaign } from '../shared/facebook';
import { BusinessParams, FacebookCampaign, Result } from '../shared/types';
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
      name: 'get-performance-facebook-campaign',
    },
  },
});

export const handler: AppSyncResolverHandler<
  BusinessParams,
  Result<FacebookCampaign>
> = Sentry.AWSLambda.wrapHandler(async (event, context) => {
  try {
    utils.logInfo(
      event,
      `Triggered ${getEventName(basename(__filename))} Event`,
    );
    utils.logInfo(context, 'Context');

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user, isManager } = await verifyUserSubscription(
      auth,
    );

    const { business_id } = event.arguments.businessInput;

    if (!user) {
      throw new StatusCodeError(185);
    }

    let facebookIntegration: boolean | string = '';
    let facebookAccessToken: string;

    let facebookInfo: FacebookCampaign = {
      facebook: '',
      campaigns_data: null,
    };

    if (isManager) {
      facebookAccessToken = user.facebook_accessToken || '';
    } else {
      const account_integrations_data = await getUserAccountIntegrationData(
        user.manager_id as string,
      );

      facebookAccessToken =
        account_integrations_data.facebook_accessToken || '';
    }

    if (facebookAccessToken) {
      const business = await checkBusiness(business_id);

      if (!business) {
        throw new StatusCodeError(1);
      }

      if (!business.facebook_ad_account_id) {
        facebookIntegration = false;

        return successResponse(
          facebookInfo,
          'Facebook account returned successfully',
        );
      }

      const response = await getFacebookAdAccountCampaign(
        business.facebook_ad_account_id as string,
        facebookAccessToken,
      );

      if (!response.ok) {
        facebookIntegration = 'expired';

        facebookInfo = {
          facebook: facebookIntegration,
          campaigns_data: null,
        };

        await updateUserFacebookAccessDetails({
          user,
          facebook_accessToken: null,
          facebook_userID: null,
        });
      } else {
        facebookIntegration = true;
        facebookInfo = {
          facebook: facebookIntegration,
          campaigns_data: response.data,
        };
      }
    } else {
      facebookInfo = {
        facebook: false,
        campaigns_data: null,
      };
    }

    return successResponse(
      facebookInfo,
      'Facebook account returned successfully',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<BusinessParams, Result<FacebookCampaign>>(
    handler,
    buildTestEvent<BusinessParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        businessInput: {
          business_id: '042ddabf-b4bb-4d6f-ae83-2f9275ae575f',
        },
      },
    }),
  );
}
