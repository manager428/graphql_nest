import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById } from '../shared/mongoDb';
import { Result } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getAllBalanceTransactions } from '../shared/stripe';
import Stripe from 'stripe';
import { StatusCodeError } from '../shared/statusCodes';
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
      name: 'get-credit-transactions',
    },
  },
});

export type GetCreditTransactionParams = {};

export type TransactionObjectResponse = {
  id: string;
  amount: number;
  ending_balance: number;
  created: number;
  type: Stripe.CustomerBalanceTransaction.Type;
};

export const handler: AppSyncResolverHandler<
  GetCreditTransactionParams,
  Result<TransactionObjectResponse[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const user = await getUserById(auth?.sub);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const stripeCustomerId = user?.subscription?.customer_id;

    const allBalanceTransactions = await getAllBalanceTransactions(
      stripeCustomerId,
    );

    if (!allBalanceTransactions || allBalanceTransactions?.data.length === 0) {
      throw new StatusCodeError(189);
    }

    const allTransactions = [];

    for (const transaction of allBalanceTransactions?.data) {
      const { id, amount, ending_balance, created, type } = transaction;

      const transactionObject = { id, amount, ending_balance, created, type };

      allTransactions.push(transactionObject);
    }

    return successResponse(
      allTransactions,
      'Credit transactions fetched successfully.',
    );
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<
    GetCreditTransactionParams,
    Result<TransactionObjectResponse[]>
  >(
    handler,
    buildTestEvent<GetCreditTransactionParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
