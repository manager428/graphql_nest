import Stripe from 'stripe';
import { UpdateUserSubscriptionCardInput } from './types';

export const createStripeCustomer = (
  payload: Stripe.CustomerCreateParams,
): Promise<Stripe.Response<Stripe.Customer>> => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  return stripe.customers.create(payload);
};

export const createStripeSubscription = (
  payload: Stripe.SubscriptionCreateParams,
) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  return stripe.subscriptions.create(payload);
};

export const createStripePaymentMethod = (
  payload: Stripe.PaymentMethodCreateParams,
) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  return stripe.paymentMethods.create(payload);
};

export const updateStripeSubscription = (
  id: string,
  payload: Stripe.SubscriptionUpdateParams,
) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  return stripe.subscriptions.update(id, payload);
};

export const getAllPromoCodes = (payload: Stripe.PromotionCodeListParams) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  return stripe.promotionCodes.list(payload);
};

export const getAllBalanceTransactions = (
  id: string,
  payload?: Stripe.CustomerBalanceTransactionListParams,
) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  return stripe.customers.listBalanceTransactions(id, payload);
};

export const payInvoices = (id: string, payload?: Stripe.InvoicePayParams) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  return stripe.invoices.pay(id, payload);
};

export const voidInvoices = (id: string) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  return stripe.invoices.voidInvoice(id);
};

export const updateCard = async (
  stripe_customer_id: string,
  payment_method: string,
) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });

  await stripe.paymentMethods.attach(payment_method, {
    customer: stripe_customer_id,
  });

  await stripe.customers.update(stripe_customer_id, {
    invoice_settings: { default_payment_method: payment_method },
  });
};

export const updateSubscriptionItems = (
  id: string,
  payload: Stripe.SubscriptionItemUpdateParams,
) => {
  const stripe = new Stripe(process.env.STRIPE_TOKEN || '', {
    apiVersion: '2022-11-15',
  });
  return stripe.subscriptionItems.update(id, payload);
};
