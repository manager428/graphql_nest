import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusiness,
  updateTiktokAdAccount,
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
import * as Sentry from '@sentry/serverless';
import { getTiktokAdInfo } from '../shared/tiktok';

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
      name: 'set-tiktok-ad-account',
    },
  },
});

export type SetTiktokAdAccountParams = {
  setTiktokAdAccountInput: {
    business_id: string;
    tik_tok_ad_account_id: string;
    tik_tok_ad_account_name: string;
  };
};

export const handler: AppSyncResolverHandler<
  SetTiktokAdAccountParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    const { business_id, tik_tok_ad_account_id, tik_tok_ad_account_name } =
      event.arguments.setTiktokAdAccountInput;

    if (!user) {
      throw new StatusCodeError(185);
    }

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await getBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(0);
    }

    if (!user.tik_tok_access_token) {
      throw new StatusCodeError(186);
    }

    if (!tik_tok_ad_account_id) {
      throw new StatusCodeError(187);
    }

    if (!tik_tok_ad_account_name) {
      throw new StatusCodeError(188);
    }

    const { data } = await getTiktokAdInfo(
      user.tik_tok_access_token,
      tik_tok_ad_account_id,
    );

    if (!data?.list) {
      throw new StatusCodeError(194);
    }

    const adAccount = data?.list[0];

    await updateTiktokAdAccount(
      user.user_id,
      business_id,
      tik_tok_ad_account_id,
      tik_tok_ad_account_name,
      adAccount.currency,
      adAccount.timezone,
    );

    return successResponse(null, statusCodes[195].message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  try {
    enableDebugMode<SetTiktokAdAccountParams, Result<null>>(
      handler,
      buildTestEvent<SetTiktokAdAccountParams>({
        userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
        group: 'Managers',
        managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
        requestPayload: {
          setTiktokAdAccountInput: {
            business_id: 'ef6a00fd-49f0-47b2-a83a-922d9ef43c7d',
            tik_tok_ad_account_id: '6921429370846314497',
            tik_tok_ad_account_name: 'Chappell Digital0124',
          },
        },
      }),
    );
  } catch (e) {
    logError(e);
    process.exit(1);
  }
}
