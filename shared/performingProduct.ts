export const getPerformingProduct = async () => {};
import { Analytics } from '@sirge-io/sirge-types';
import { Business } from '@sirge-io/sirge-utils';
import { getBusinessAnalytics, updateBusinessAnalytics } from './dynamoDb';
import { getShopifyProductOrders } from './shopify';
import { LineItem, Order, OrderProduct, OrderResult } from './types';

const getTopSellingProducts = async (
  orders: Order[],
  topCount: number,
  analytics: Analytics,
): Promise<OrderResult> => {
  const today = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;
  const oneMonthMs = 30 * oneDayMs;
  const timeDurationMsArray = [oneDayMs, oneWeekMs, oneMonthMs];

  let result: OrderResult = {
    daily: new Array(topCount).fill({} as OrderProduct),
    weekly: new Array(topCount).fill({} as OrderProduct),
    monthly: new Array(topCount).fill({} as OrderProduct),
  };

  timeDurationMsArray.forEach((timeDurationMs, index) => {
    const startDateMs = today.getTime() - timeDurationMs;
    const startDate = new Date(startDateMs);
    const products: { [product_id: number]: OrderProduct } = {};
    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      if (orderDate >= startDate && orderDate <= today) {
        order.line_items.forEach((lineItem: LineItem) => {
          const { name, product_id, price, quantity } = lineItem;
          let prodPrice = Number(price);
          if (products[product_id]) {
            products[product_id].totalPrice += prodPrice * quantity;
            products[product_id].ordersCount += 1;
          } else {
            products[product_id] = {
              name,
              product_id,
              totalPrice: prodPrice * quantity,
              ordersCount: 1,
            };
          }
        });
      }
    });
    const productsList = Object.values(products);
    productsList.sort((a, b) => b.totalPrice - a.totalPrice);
    if (index === 0) {
      result.daily = productsList.slice(0, topCount);
    } else if (index === 1) {
      result.weekly = productsList.slice(0, topCount);
    } else {
      result.monthly = productsList.slice(0, topCount);
    }
  });

  await updateBusinessAnalytics(result, analytics);
  return result;
};

export const getPerformingProductFromShopify = async (business: Business) => {
  if (
    !business?.shopify_access_token ||
    business?.shopify_access_token === ''
  ) {
    return false;
  }

  let orderAfter: string | null = null,
    lineItemAfter: string | null = null,
    resultArray: any = [],
    lineItems: any = [];

  const returnQuery = (
    orderAfter: string | null,
    lineItemAfter: string | null,
  ) => {
    const query = `
  {
    orders(first: 20 ${orderAfter && `, after: ${orderAfter}`}}) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
      }
      edges {
        node {
          id
          createdAt
          lineItems(first: 20 ${
            lineItemAfter && `, after: ${lineItemAfter}`
          }}) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              endCursor
            }
            edges {
              node {
                id
                name
                quantity
                variant {
                  displayName
                  id
                  price
              }
                product {
                  id
                }
              }
            }
          }
        }
      }
    }
  }`;
    return query;
  };

  let data = await getShopifyProductOrders(
    business,
    returnQuery(orderAfter, lineItemAfter),
  );

  const orders = data?.data?.orders;

  for (const order of orders?.edges) {
    if (!orders?.pageInfo?.hasNextPage) {
      if (order?.node?.lineItems?.pageInfo?.hasNextPage) {
        lineItemAfter = order?.node?.lineItems?.pageInfo?.endCursor;

        lineItems = order?.node?.lineItems?.edges?.map((item: any) => ({
          id: item?.node?.id,
          name: item?.node?.name,
          quantity: item?.node?.quantity,
          product_id: item?.node?.product?.id,
          price: item?.node?.variant?.price,
        }));

        resultArray.push({
          id: order?.node?.id,
          created_at: order?.node?.createdAt,
          line_items: lineItems,
        });

        data = await getShopifyProductOrders(
          business,
          returnQuery(null, lineItemAfter),
        );
      } else {
        lineItems = order?.node?.lineItems?.edges?.map((item: any) => ({
          id: item?.node?.id,
          name: item?.node?.name,
          quantity: item?.node?.quantity,
          product_id: item?.node?.product?.id,
        }));

        resultArray.push({
          id: order?.node?.id,
          created_at: order?.node?.createdAt,
          line_items: lineItems,
        });
      }
      return resultArray;
    } else if (orders?.pageInfo?.hasNextPage) {
      orderAfter = orders?.pageInfo?.endCursor;

      if (order?.node?.lineItems?.pageInfo?.hasNextPage) {
        lineItemAfter = order?.node?.lineItems?.pageInfo?.endCursor;

        lineItems = order?.node?.lineItems?.edges?.map((item: any) => ({
          id: item?.node?.id,
          name: item?.node?.name,
          quantity: item?.node?.quantity,
          product_id: item?.node?.product?.id,
        }));

        resultArray.push({
          id: order?.node?.id,
          created_at: order?.node?.createdAt,
          line_items: lineItems,
        });

        data = await getShopifyProductOrders(
          business,
          returnQuery(null, lineItemAfter),
        );
      } else {
        lineItems = order?.node?.lineItems?.edges?.map((item: any) => ({
          id: item?.node?.id,
          name: item?.node?.name,
          quantity: item?.node?.quantity,
          product_id: item?.node?.product?.id,
        }));

        resultArray.push({
          id: order?.node?.id,
          created_at: order?.node?.createdAt,
          line_items: lineItems,
        });
      }

      data = await getShopifyProductOrders(
        business,
        returnQuery(orderAfter, lineItemAfter),
      );
    }
  }

  const analytics = await getBusinessAnalytics(business?.business_id);

  await getTopSellingProducts(resultArray, 5, analytics);
};
