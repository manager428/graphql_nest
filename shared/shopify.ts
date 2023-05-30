import { Business } from '@sirge-io/sirge-types';

require('dotenv').config();

export const getShopify = async (business: Business, visitor_email: string) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': business.shopify_access_token
        ? business.shopify_access_token
        : '',
    };

    const resp = await fetch(
      `https://${business.shopify_store_url}/admin/api/2020-04/customers/search.json?query=${visitor_email}`,
      {
        headers: headers,
      },
    );

    const { data } = await resp.json();
    return data;
  } catch (error) {
    console.log(`Error occurred trying to get the shopify `);
    throw error;
  }
};

export const getShopifyProductOrders = async (
  business: Business,
  query: string,
) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': business.shopify_access_token ?? '',
    };

    const resp = await fetch(
      `https://${business.shopify_store_url}/admin/api/2023-01/graphql.json`,
      {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query: query }),
      },
    );

    const { data } = await resp.json();
    return data;
  } catch (error) {
    console.log(`Error occurred trying to get the shopify orders`);
    throw error;
  }
};
