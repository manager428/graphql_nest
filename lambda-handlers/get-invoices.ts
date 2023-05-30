import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById } from '../shared/mongoDb';
import { InvoiceObject, Result } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
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
      name: 'get-invoices',
    },
  },
});

export type GetInvoices = {};

export const handler: AppSyncResolverHandler<
  GetInvoices,
  Result<InvoiceObject[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const user = await getUserById(auth?.sub);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const stripeCustomerId = user?.subscription?.customer_id;

    const invoices = user?.invoices.filter(
      (invoice) => invoice.customer_id === stripeCustomerId,
    );

    if (!invoices?.length) {
      throw new StatusCodeError(108);
    }

    const allInvoices = invoices.map((invoice) => {
      const decode = JSON.parse(Buffer.from(invoice?.invoice_body).toString());

      const {
        id,
        number,
        created,
        status,
        invoice_pdf,
        amount_paid,
        amount_due,
      } = decode;

      const invoiceObject = {
        invoice_id: id,
        invoice_number: number,
        created,
        status,
        invoice_pdf,
        total: status === InvoiceStatus.PAID ? amount_paid : amount_due,
      };

      return invoiceObject;
    });

    return successResponse(allInvoices, 'Invoices fetched successfully.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetInvoices, Result<InvoiceObject[]>>(
    handler,
    buildTestEvent<GetInvoices>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    }),
  );
}
