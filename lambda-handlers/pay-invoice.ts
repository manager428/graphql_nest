import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById } from '../shared/mongoDb';
import { PayInvoiceInput, Result } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { payInvoices } from '../shared/stripe';
import { validatePayloadRequiredKeys } from '../shared/validatePayloadRequiredKeys';
import { StatusCodeError, statusCodes } from '../shared/statusCodes';
import { InvoiceStatus } from '@sirge-io/sirge-utils';
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
      name: 'pay-invoice',
    },
  },
});

export const handler: AppSyncResolverHandler<
  PayInvoiceInput,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    validatePayloadRequiredKeys(['invoice_id'], event?.arguments);

    const user = await getUserById(auth?.sub);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const stripeCustomerId = user?.subscription?.customer_id;

    const invoices = user?.invoices?.map(
      (invoice) =>
        invoice.customer_id === stripeCustomerId &&
        invoice.id === event?.arguments.invoice_id,
    );

    if (!invoices || invoices.length === 0) {
      throw new StatusCodeError(108);
    }

    const filteredInvoices = user?.invoices.filter(
      (invoice) =>
        invoice.status === InvoiceStatus.UNCOLLECTABLE ||
        invoice.status === InvoiceStatus.PAST_DUE,
    );

    if (filteredInvoices.length === 0) {
      throw new StatusCodeError(109);
    }

    await payInvoices(event?.arguments.invoice_id, {});

    return successResponse(null, statusCodes[110].message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<PayInvoiceInput, Result<null>>(
    handler,
    buildTestEvent<PayInvoiceInput>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        invoice_id: 'www',
      },
    }),
  );
}
