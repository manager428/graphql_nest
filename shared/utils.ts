import { AnyArn } from 'aws-sdk/clients/groundstation';

// Logger Functions
export const logInfo = (
  message: string | Record<string, any> | unknown,
  title: string | undefined = undefined,
): void => {
  if (typeof message === 'string') {
    title ? console.info(`${title}: ${message}`) : console.info(message);
  } else {
    title
      ? console.info(`${title}:`, JSON.stringify(message, null, 2))
      : console.info(JSON.stringify(message, null, 2));
  }
};
export const logError = (
  message: string | Record<string, any> | unknown,
  title: string | undefined = undefined,
): void => {
  if (typeof message === 'string') {
    title ? console.error(`${title}: ${message}`) : console.error(message);
  } else {
    title
      ? console.error(`${title}:`, JSON.stringify(message, null, 2))
      : console.error(JSON.stringify(message, null, 2));
  }
};
export const logWarn = (
  message: string | Record<string, any> | unknown,
  title: string | undefined = undefined,
): void => {
  if (typeof message === 'string') {
    title ? console.warn(`${title}: ${message}`) : console.warn(message);
  } else {
    title
      ? console.warn(`${title}:`, JSON.stringify(message, null, 2))
      : console.warn(JSON.stringify(message, null, 2));
  }
};
export const logDebug = (
  message: string | Record<string, any> | unknown,
  title: string | undefined = undefined,
): void => {
  if (process.env.LOG_LEVEL === 'debug') {
    if (typeof message === 'string') {
      title ? console.debug(`${title}: ${message}`) : console.debug(message);
    } else {
      title
        ? console.debug(`${title}:`, JSON.stringify(message, null, 2))
        : console.debug(JSON.stringify(message, null, 2));
    }
  }
};
export const reservedBusinessNames = [
  'sirge',
  'dev',
  'api',
  'help',
  'static',
  'assets',
  'domains',
  'roadmap',
  'accounts',
  'account',
  'cdn',
  'auth',
  'notify',
  'track',
  'tracking',
];

export const getInfoCampaignsTikTok = (
  insights: any,
  convert_currency: boolean,
  convert_two_currency: boolean,
  base_exchange_rate: number,
  account_exchange_rate: number,
) => {
  let insight_data = insights[0].metrics.total_complete_payment_rate;

  let conversion_value_conversion1 = null;
  let conversion_value_conversion2 = null;
  let source_data_conversion_value = null;
  let source_data_amount_spent = null;
  let source_data_cost_per_purchase = null;

  if (convert_currency && convert_two_currency) {
    conversion_value_conversion1 = Math.round(
      (insight_data * base_exchange_rate * 100) / 100,
    );
    conversion_value_conversion2 = Math.round(
      (conversion_value_conversion1 * account_exchange_rate * 100) / 100,
    );
    source_data_conversion_value = conversion_value_conversion2;

    let spend_value_conversion1 = Math.round(
      (insight_data.spend * base_exchange_rate * 100) / 100,
    );
    let spend_value_conversion2 = Math.round(
      (spend_value_conversion1 * account_exchange_rate * 100) / 100,
    );
    source_data_amount_spent = spend_value_conversion2;

    let cost_per_purchase_value_conversion1 = Math.round(
      (insight_data.cost_per_conversion * base_exchange_rate * 100) / 100,
    );
    let cost_per_purchase_value_conversion2 = Math.round(
      (cost_per_purchase_value_conversion1 * account_exchange_rate * 100) / 100,
    );
    source_data_cost_per_purchase = cost_per_purchase_value_conversion2;
  } else if (convert_currency) {
    let conversion_value_conversion1 = Math.round(
      (insight_data.total_complete_payment_rate * account_exchange_rate * 100) /
        100,
    );
    source_data_conversion_value = conversion_value_conversion1;

    let spend_value_conversion1 = Math.round(
      (insight_data.spend * account_exchange_rate * 100) / 100,
    );
    source_data_amount_spent = spend_value_conversion1;

    let cost_per_purchase_value_conversion1 = Math.round(
      (insight_data.cost_per_conversion * account_exchange_rate * 100) / 100,
    );
    source_data_cost_per_purchase = cost_per_purchase_value_conversion1;
  } else {
    source_data_conversion_value = Math.round(
      insight_data.total_complete_payment_rate,
    );
    source_data_amount_spent = Math.round(insight_data.spend);
    source_data_cost_per_purchase = Math.round(
      insight_data.cost_per_conversion,
    );
  }

  let source_data_clicks = Number(insight_data.clicks);
  let source_data_purchases = Number(insight_data.conversion);
  let source_data_roas = `${Math.round(insight_data.complete_payment_roas)} x`;

  return {
    conversion_value_conversion1,
    conversion_value_conversion2,
    source_data_conversion_value,
    source_data_amount_spent,
    source_data_cost_per_purchase,
    source_data_clicks,
    source_data_purchases,
    source_data_roas,
  };
};

export const getInfoCampaignsFacebook = (
  insights: any,
  convert_currency: boolean,
  convert_two_currency: boolean,
  base_exchange_rate: number,
  account_exchange_rate: number,
  isAd: boolean = false,
) => {
  let { spend, purchase_roas, actions, cost_per_action_type, action_values } =
    insights[0];

  let conversion_value_conversion1 = null;
  let conversion_value_conversion2 = null;
  let source_data_conversion_value = null;
  let source_data_amount_spent = null;
  let source_data_cost_per_purchase = null;
  let source_data_roas = null;
  let source_data_purchases = 0;
  let source_data_clicks = 0;

  if (convert_currency && convert_two_currency) {
    conversion_value_conversion1 = Math.round(
      (spend * base_exchange_rate * 100) / 100,
    );

    conversion_value_conversion2 = Math.round(
      (conversion_value_conversion1 * account_exchange_rate * 100) / 100,
    );

    source_data_amount_spent = conversion_value_conversion2;
  } else if (convert_currency) {
    const exchangeRate = isAd ? account_exchange_rate : base_exchange_rate;

    conversion_value_conversion1 = Math.round(
      (spend * exchangeRate * 100) / 100,
    );
    source_data_amount_spent = conversion_value_conversion1;
  } else {
    source_data_amount_spent = Math.round(spend);
  }

  const roas_object = purchase_roas.find(
    (purchase: any) => purchase?.action_type === 'omni_purchase',
  );

  if (roas_object) {
    source_data_roas = `${Math.round(roas_object?.value)} x`;
  }

  actions.forEach((actions_object: any) => {
    if (actions_object?.action_type === 'omni_purchase') {
      source_data_purchases = Number(actions_object?.value);
    } else if (actions_object?.action_type === 'link_click') {
      source_data_clicks = Number(actions_object?.value);
    }
  });

  if (isAd) {
    cost_per_action_type.forEach((actions_object: any) => {
      if (actions_object?.action_type === 'purchase') {
        if (convert_currency && convert_two_currency) {
          const conversion1 = Math.round(
            (Number(actions_object?.value) * base_exchange_rate * 100) / 100,
          );
          const conversion2 = Math.round(
            (conversion1 * account_exchange_rate * 100) / 100,
          );

          source_data_cost_per_purchase = conversion2;
        } else if (convert_currency) {
          const conversion1 = Math.round(
            (Number(actions_object?.value) * account_exchange_rate * 100) / 100,
          );

          source_data_cost_per_purchase = conversion1;
        } else {
          source_data_cost_per_purchase = Math.round(
            Number(actions_object?.value),
          );
        }
      }
    });

    action_values.forEach((actions_object: any) => {
      if (actions_object?.action_type === 'omni_purchase') {
        if (convert_currency && convert_two_currency) {
          const conversion1 = Math.round(
            (Number(actions_object?.value) * base_exchange_rate * 100) / 100,
          );
          const conversion2 = Math.round(
            (conversion1 * account_exchange_rate * 100) / 100,
          );

          source_data_conversion_value = conversion2;
        } else if (convert_currency) {
          const conversion1 = Math.round(
            (Number(actions_object?.value) * account_exchange_rate * 100) / 100,
          );

          source_data_conversion_value = conversion1;
        } else {
          source_data_conversion_value = Math.round(
            Number(actions_object?.value),
          );
        }
      }
    });
  }

  return {
    conversion_value_conversion1,
    conversion_value_conversion2,
    source_data_conversion_value,
    source_data_amount_spent,
    source_data_cost_per_purchase,
    source_data_clicks,
    source_data_purchases,
    source_data_roas,
  };
};
