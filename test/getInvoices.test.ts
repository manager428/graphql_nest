import { Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import { InvoiceObject, Result, SuccessResponse } from '../shared/types';
import { GetInvoices, handler } from './../lambda-handlers/get-invoices';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  let context: Context;
  let callback: Callback<Result<InvoiceObject[]>>;

  beforeEach(() => {
    context = getTestContext();

    callback = () => {};
  });

  beforeAll(() => {
    if (process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
      AWS.config.update({
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
        region: 'us-west-2',
      });
    }
  });

  it('verifies successful response', async () => {
    const event = buildTestEvent<GetInvoices>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {},
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      InvoiceObject[]
    >;

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    if (data) {
      expect(data[0].invoice_id).toBeDefined();
      expect(data[0].invoice_number).toBeDefined();
      expect(data[0].status).toBeDefined();
      expect(data[0].created).toBeDefined();
      expect(data[0].total).toBeDefined();
      expect(data[0].invoice_pdf).toBeDefined();
    }

    expect(message).toBeDefined();
    expect(message).toEqual('Invoices fetched successfully.');
  });
});
