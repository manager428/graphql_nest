import { StatusCodeError } from './../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  deactivateBusiness,
  getBusinessStatusByUserId,
  getVerificationMethod,
  getVerifyCode,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { getEventName } from '../shared/getEventName';
import { BusinessStatus } from '@sirge-io/sirge-utils';
import { DeleteBusinessParams, Result } from '../shared/types';
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
      name: 'delete-business-by-businessid',
    },
  },
});

export const handler: AppSyncResolverHandler<
  DeleteBusinessParams,
  Result<boolean>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const {
      deleteBusinessesInput: { business_id, two_factor_code },
    } = event.arguments as DeleteBusinessParams;

    const business = await getBusinessStatusByUserId({
      business_id,
      user_id: user?.user_id,
      status: BusinessStatus.ACTIVE,
    });

    if (!business) {
      throw new StatusCodeError(1);
    }
    //---------------------------------
    const user_data = await getVerificationMethod(user?.user_id);

    if (user_data) {
      if (!two_factor_code) {
        throw new StatusCodeError(145);
      }

      const twofactor = await getVerifyCode(user?.user_id, two_factor_code);

      if (!(twofactor == 'verified')) {
        throw new StatusCodeError(138);
      }
    }
    //--------------------------------------
    const result = await deactivateBusiness(
      business_id,
      user?.user_id,
      BusinessStatus.ACTIVE,
    );

    return successResponse(result, 'Business deactivated');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<DeleteBusinessParams, Result<boolean>>(
    handler,
    buildTestEvent<DeleteBusinessParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        deleteBusinessesInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
          two_factor_code: ' ',
        },
      },
    }),
  );
}
