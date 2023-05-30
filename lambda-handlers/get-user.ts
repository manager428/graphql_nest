import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById } from '../shared/mongoDb';
import {
  User,
  SubscriptionStatuses,
  AccountStates,
} from '@sirge-io/sirge-utils';
import { Result } from '../shared/types';
import { logInfo } from '../shared/utils';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { StatusCodeError } from '../shared/statusCodes';
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
      name: 'get-user',
    },
  },
});

export type GetUserParams = {};

const setAccountState = (user: User): AccountStates => {
  if (
    user.invoices &&
    user.invoices.length > 0 &&
    user.invoices.find((invoice) => invoice.status === 'uncollectable')
  ) {
    return AccountStates.FROZEN;
  } else {
    if (
      [SubscriptionStatuses.ACTIVE, SubscriptionStatuses.TRIALING].includes(
        user.subscription?.status as SubscriptionStatuses,
      )
    ) {
      return AccountStates.ACTIVE;
    } else {
      return AccountStates.CANCELED;
    }
  }
};

export const handler: AppSyncResolverHandler<
  GetUserParams,
  Result<User>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const user = await getUserById(auth.sub);

    if (!user) {
      throw new StatusCodeError(185);
    }

    if (!user.manager_id) {
      user.account_state = setAccountState(user);
      user.phone_number = user.phone_number
        ? user.phone_number.substring(-4)
        : null;
      user.affiliate_auth_token = user.firstpromoter_auth_token;
      user.client_billing_account_id = user.stripe_connect_account_id;

      if (user.tik_tok_access_token) {
        user.tik_tok_integration = true;
      } else {
        user.tik_tok_integration = false;
      }
    } else {
      const managingUser = await getUserById(user.manager_id);
      if (!managingUser) {
        throw new Error('No managing user');
      }

      user.account_state = setAccountState(managingUser);

      user.currency = managingUser.currency;
      user.timezone = managingUser.timezone;
      user.subscription.status = managingUser.subscription.status;
      user.phone_number = user.phone_number
        ? user.phone_number.substring(-4)
        : null;
    }

    logInfo(`User returned: ${JSON.stringify(user)}`);

    return successResponse(user);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetUserParams, Result<User>>(
    handler,
    buildTestEvent<GetUserParams>({
      userId: 'ca927067-d916-4d68-b133-ef4b296deca7',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {},
    }),
  );
}
