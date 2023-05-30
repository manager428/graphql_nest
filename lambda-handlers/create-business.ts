import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessByVanityName,
  countBusinessByStatus,
  saveNewBusiness,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { Business, BusinessStatus } from '@sirge-io/sirge-utils';
import { Result, CreateBusinessParams } from '../shared/types';
import { logInfo, reservedBusinessNames } from '../shared/utils';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import crypto from 'crypto';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
import { getBusiness } from '../shared/mongoDb';
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
      name: 'create-business',
    },
  },
});

export const handler: AppSyncResolverHandler<
  CreateBusinessParams,
  Result<Business>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const { business_name } = event?.arguments?.createBusinessInput;

    let business_name_format = business_name.toLowerCase().replace(/'/g, '');
    business_name_format = business_name_format.replace(/\s+/g, '');
    business_name_format = business_name_format.replace(/_/g, '-');

    if (reservedBusinessNames.includes(business_name_format)) {
      throw new Error(
        `The vanity name of ${business_name} has already been reserved. Please contact support`,
      );
    }

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const plan = user?.user_plan;
    const businessLimit = plan?.business_limit;

    if (plan && plan?.plan_code !== 'bolt_pro') {
      const { businessCount } = await countBusinessByStatus({
        user_id: user?.user_id,
        status: BusinessStatus.ACTIVE,
      });

      if (businessCount + 1 > businessLimit) {
        throw new StatusCodeError(4);
      }
    }

    const business = await getBusinessByVanityName(business_name_format);

    if (business) {
      throw new StatusCodeError(112);
    }

    const params = {
      business_id: crypto.randomUUID(),
      status: BusinessStatus.ACTIVE,
      user_id: user?.user_id,
      vanity_name: business_name_format,
      business_name: business_name,
    };

    await saveNewBusiness(params);

    const newBusiness = await getBusiness(params.business_id);

    return successResponse(newBusiness, `Business created successfully.`);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<CreateBusinessParams, Result<Business>>(
    handler,
    buildTestEvent<CreateBusinessParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        createBusinessInput: {
          business_name: 'New Age Advertising',
        },
      },
    }),
  );
}
