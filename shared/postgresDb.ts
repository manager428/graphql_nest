import { getDbCredentials, getWriterDbConnstring } from './config';
import ServerlessClient from 'serverless-postgres';
import { AdSet, PageView, PageViewCount } from '@sirge-io/sirge-utils';
import { Performance } from '@sirge-io/sirge-types';
import { logInfo } from './utils';
import { TypePurchases } from '../lambda-handlers/get-purchases-by-business';
import { SortObjectType } from '../lambda-handlers/get-all-visitors';
import { Ads, SourcesSortObjectType, VisitorAddressParam } from './types';
import { FilterObjectType } from '../lambda-handlers/get-all-visitors-mongo';

const tableName = 'page_view';

let client: ServerlessClient | null = null;

export const postgresConn = async () => {
  try {
    const creds = await getDbCredentials();
    const writerConnString = await getWriterDbConnstring();

    return new ServerlessClient({
      user: creds.username,
      host: writerConnString,
      database: process.env.DB_DATABASE,
      password: creds.pw,
      debug: ['test', 'production'].includes(process.env.NODE_ENV as string)
        ? false
        : true,
      delayMs: 3000,
      port: 5432,
    });
  } catch (error) {
    throw `Error trying to connect to db: ${error}`;
  }
};

type getPageViewOptions = {
  businessIds: string;
  dateStart: string;
  dateEnd: string;
};

export const getPageViews = async (
  { businessIds, dateStart, dateEnd }: getPageViewOptions,
  returnCount: boolean = false,
): Promise<PageView[] | PageViewCount[]> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    await client?.connect();

    // get page views where business IDs match and between currentBillingPeriodStart and currentBillingPeriodEnd. return count as totalUsage
    const res = (
      await client?.query(
        `SELECT ${
          returnCount ? 'COUNT(1)' : '*'
        } FROM ${tableName} WHERE business_id IN (${businessIds}) AND created >= ${dateStart} AND created < ${dateEnd}`,
      )
    ).rows;

    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PageViews: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getPageViewStatus = async (
  businessId: string,
): Promise<boolean> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    await client?.connect();

    const res = (
      await client?.query(
        `SELECT COUNT(*)
       FROM ${tableName} WHERE business_id = '${businessId}'`,
      )
    ).rows[0]['count'];

    client?.clean();
    return res > 0;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PageViewStatus: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getPageViewsCampaigns = async (
  business_id: string,
  source_keys: string,
  selected_campaigns: string,
  dateStart: string,
  dateEnd: string,
): Promise<
  (PageView & { purchases_count: number; clicks_count: number })[]
> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    await client?.connect();

    const res = (
      await client?.query(
        `
        SELECT MAX(p.sirge_campaign_id) as sirge_campaign_id, MAX(p.campaign) as campaign, SUM(CASE WHEN p.order_id IS NOT NULL THEN 1 
          ELSE 0 
          END
          ) as purchases_count,
          SUM(CASE WHEN p.visitor_id IS NOT NULL THEN 1 
            ELSE 0 
            END
            ) as clicks_count,
            p.created as created
            FROM ${tableName} p
            WHERE business_id = '${business_id}'
            AND p.source IN ('${source_keys}')
            AND p.sirge_adset_id IS NOT NULL
            AND (p.sirge_campaign_id IN ('${selected_campaigns}')  OR p.sirge_campaign_id IS NOT NULL)
            AND p.created >= ${dateStart} AND p.created < ${dateEnd}
          GROUP BY p.sirge_campaign_id
          ORDER BY created DESC`,
      )
    ).rows;

    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PageViewStatus: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getPageViewVisitorInfo = async (
  business_id: string,
  visitor_id: string,
): Promise<{
  visitorId: string;
  visitor_name: string;
  ip: string;
  visitor_phone: string;
  visitor_email: string;
  visitor_address: VisitorAddressParam;
  first_visit: string;
  purchases: string;
  page_views: PageView[];
  sources: PageView[];
}> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    await client?.connect();

    const visitorId = (
      await client?.query(
        ` SELECT visitor_id
          FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} AND visitor_id IS NOT NULL`,
      )
    )?.rows?.[0]?.['visitor_id'];

    const visitor_name = (
      await client?.query(
        `SELECT visitor_name
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} AND visitor_name IS NOT NULL`,
      )
    )?.rows?.[0]?.['visitor_name'];

    const ip = (
      await client?.query(
        `SELECT ip
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} AND ip IS NOT NULL`,
      )
    ).rows[0]['ip'];

    const visitor_phone = (
      await client?.query(
        `SELECT visitor_phone
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} AND visitor_phone IS NOT NULL`,
      )
    ).rows[0]['visitor_phone'];

    const visitor_email = (
      await client?.query(
        `SELECT visitor_email
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} AND visitor_email IS NOT NULL`,
      )
    ).rows[0]['visitor_email'];

    const visitor_address = (
      await client?.query(
        `SELECT visitor_address
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} AND visitor_address IS NOT NULL`,
      )
    ).rows[0]['visitor_address'];

    const first_visit = (
      await client?.query(
        `SELECT created
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} ORDER BY created ASC`,
      )
    ).rows[0]['created'];

    const purchases = (
      await client?.query(
        `SELECT COUNT(*)
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} AND order_id IS NOT NULL GROUP BY order_id ASC`,
      )
    ).rows[0]['count'];

    const page_views = (
      await client?.query(
        `SELECT source, url, referer, order_id, checkout_platform, conversion_value, campaign, ad_set, ad, created
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} ORDER BY created ASC`,
      )
    ).rows;

    const sources = (
      await client?.query(
        `SELECT source, referer, created
         FROM page_views WHERE business_id = ${business_id} AND visitor_id = ${visitor_id} GROUP BY source ORDER BY created DESC`,
      )
    ).rows;

    client?.clean();

    return {
      visitorId,
      visitor_name,
      ip,
      visitor_phone,
      visitor_email,
      visitor_address,
      first_visit,
      purchases,
      page_views,
      sources,
    };
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PageViewVisitorInfo: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getPageViewsTotalSpent = async (
  business_id: string,
  visitor_id: string,
): Promise<PageView[]> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    await client?.connect();

    const res = (
      await client?.query(
        ` SELECT 
        SUM(p.conversion_value) as conversion_value
        FROM page_view p
        WHERE p.business_id = '${business_id}'
          AND p.visitor_id IN ('${visitor_id}')
        GROUP BY p.visitor_id`,
      )
    ).rows;

    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PageViewsTotalSpent: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getBusinessSourcesByBusinessId = async (
  business_id: string,
  dateStart: string,
  dateEnd: string,
  currentPage?: number,
  sort?: SourcesSortObjectType,
): Promise<{
  sources: PageView[];
  numberPages: number;
}> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    await client?.connect();

    const numberOfItems = 25;

    const res = await client.query(
      `
      SELECT p.source as source, p.url as url, MAX(p.created) as created, MAX(p.referer) as referer,
      SUM(CASE WHEN p.order_id IS NOT NULL THEN 1 
        ELSE 0 
        END
        ) as purchases_count,
        SUM(CASE WHEN p.source IS NOT NULL THEN 1 
          ELSE 0 
          END
          ) as clicks_count
        FROM ${tableName} p
        WHERE business_id = '${business_id}' 
        AND p.created >= '${dateStart}' AND p.created <= '${dateEnd}'
        GROUP BY source, url
        ORDER BY ${sort?.field} ${sort?.sort.toUpperCase()}
        LIMIT ${currentPage ? numberOfItems : 250} ${
        currentPage ? `OFFSET ${numberOfItems * currentPage}` : ''
      }
      `,
    );

    const { rows: rowsCount } = await client.query(
      `
        WITH cte AS (
          SELECT row_number() OVER () AS row
          FROM ${tableName}
          WHERE business_id = '${business_id}'
        AND created >= '${dateStart}' AND created <= '${dateEnd}'
        GROUP BY source, url
      )
      SELECT MAX(row) AS count FROM cte;
      `,
    );

    client?.clean();

    return {
      sources: res.rows,
      numberPages: Math.ceil(rowsCount[0]?.count / numberOfItems),
    };
  } catch (error) {
    const err = error as Error;
    console.log(
      `Error occurred trying to get BusinessSourcesByBusinessId: ${err}`,
    );

    await client?.end();

    throw err;
  }
};

export const getPageViewsByGroup = async (
  business_id: string,
  source: string,
  selected_array: {
    isSelectedCampaign?: boolean;
    array: string[] | number[];
  },
  dateStart: Date,
  dateEnd: Date,
  isAdQuery: boolean = false,
): Promise<AdSet[]> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    let adQuery: string = '';

    const parseArray = selected_array.array.join("','");

    if (isAdQuery) {
      adQuery = `
      AND p.ad IS NOT NULL
      AND p.sirge_ad_id IS NOT NULL`;

      if (selected_array.isSelectedCampaign) {
        adQuery = `
        ${adQuery}
        AND p.sirge_campaign_id IN ('${parseArray}') 
      `;
      } else if (selected_array.array.length > 0) {
        adQuery = `
        ${adQuery}
        AND p.sirge_adset_id IN ('${parseArray}')
        AND p.sirge_campaign_id IS NOT NULL
      `;
      } else {
        adQuery = `
        ${adQuery}
        AND p.sirge_campaign_id IS NOT NULL
        AND p.sirge_adset_id IS NOT NULL
      `;
      }
    }

    await client?.connect();

    const res = (
      await client?.query(
        `SELECT MAX(p.sirge_ad_id) as sirge_ad_id, MAX(p.sirge_adset_id) as sirge_adset_id, MAX(p.id) as id, MAX(p.sirge_campaign_id) as total_sirge, MAX(p.campaign) as total_campaign, 
         COUNT(p.order_id) as purchases_count,
         COUNT(p.visitor_id) as visitor_id,
         SUM(CAST(p.conversion_value as numeric)) as conversion_value
          FROM ${tableName} p
          WHERE p.business_id = ('${business_id}') 
            AND p.source IN ('${source}')
            AND p.ad_set IS NOT NULL 
            AND p.sirge_adset_id IS NOT NULL
            ${adQuery || `AND p.sirge_campaign_id IN ('${parseArray}')`}
            AND p.created >= '${dateStart
              .toISOString()
              .replace('T', ' ')}' AND p.created < '${dateEnd
          .toISOString()
          .replace('T', ' ')}'
          GROUP BY p.sirge_campaign_id`,
      )
    ).rows;

    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PageViewsByGroup: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getPurchasesOfBusiness = async (
  business_id: string,
  dateStart: string,
  dateEnd: string,
  typePurchases: TypePurchases = 'campaigns',
  source_keys: string[],
  selected_ids: number[],
) => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    await client?.connect();

    const conditionalPurcharses =
      typePurchases === 'campaigns'
        ? `AND sirge_campaign_id IN(${selected_ids.join()})`
        : typePurchases === 'ad_sets'
        ? `AND sirge_adset_id IN(${selected_ids.join()})`
        : `AND sirge_ad_id IN(${selected_ids.join()})`;

    const res = await client.query(
      `
        SELECT p.id as id, p.visitor_id as visitor_id, p.source as source, MAX(p.created) as created, MAX(p.referer) as referer,
        p.visitor_name as visitor_name, SUM(
          CASE WHEN p.order_id IS NOT NULL THEN 1 
          ELSE  0
          END
        ) as purchases_count,
        SUM(
          CASE WHEN p.conversion_value IS NOT NULL THEN 1 
          ELSE  0
          END
        ) as conversion_value
        FROM ${tableName} p
        WHERE business_id = '${business_id}'
        AND source IN(${source_keys.map((source) => `'${source}'`).join(', ')})
        ${conditionalPurcharses}  
        AND p.created >= '${dateStart}' AND p.created < '${dateEnd}'
        GROUP BY id, visitor_id
        ORDER BY created DESC
      `,
    );

    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PurchasesOfBusiness: ${err}`);

    await client?.end();

    throw err;
  }
};

const filtersQueryMaker = async (
  field: string,
  operator: string,
  value: string | number,
) => {
  let query = '';
  if (operator === 'Equals') {
    query = `AND p.${field} = ${value}`;
  } else if (operator === 'Starts with') {
    query = `AND p.${field}::text LIKE '${value}%'`;
  } else if (operator === 'End with') {
    query = `AND p.${field}::text LIKE '%${value}'`;
  } else if (operator === 'Contains') {
    query = `AND p.${field}::text LIKE '%${value}%'`;
  } else if (operator === 'Is empty') {
    query = `AND p.${field} IS NULL`;
  } else if (operator === 'Is not empty') {
    query = `AND p.${field} IS NOT NULL`;
  }
  return query;
};

export const getVisitorsOfBusiness = async (
  business_id: string,
  dateStart: string,
  dateEnd: string,
  offset: number,
  numberOfRecords: number,
  sort?: SortObjectType,
  filter?: FilterObjectType[],
) => {
  try {
    await client?.connect();
    if (!client) {
      client = await postgresConn();
      await client?.connect();
      logInfo(`Initializing a new postgres client connection`);
    }

    let filters = '';
    let having = '';
    if (filter) {
      await filter.forEach(async (element: FilterObjectType) => {
        if (element.field == 'visitor_name') {
          filters += await filtersQueryMaker(
            element.field,
            element.operator,
            element.value,
          );
        } else if (element.field == 'purchases_count') {
          having += `HAVING COUNT(CASE WHEN p.order_id IS NOT NULL THEN 1 END) ${element.operator} ${element.value}`;
        } else if (element.field == 'clicks_count') {
          having += `HAVING COUNT(CASE WHEN p.visitor_id IS NOT NULL THEN 1 END) ${element.operator} ${element.value}`;
        }
      });
    }

    let query = `
      SELECT
        p.visitor_id as visitor_id,
        p.stored_at as date,
        p.sirge_source_name as sirge_source_name,
        MAX(p.created) as last_visited,
        MAX(p.referer) as referer,
        p.visitor_name as visitor_name,
        SUM(
          CASE WHEN p.order_id IS NOT NULL THEN 1 ELSE  0 END
        ) as purchases_count,
        SUM(
          CASE WHEN p.conversion_value IS NOT NULL THEN p.conversion_value ELSE  0 END
        ) as conversion_value,
        SUM(
          CASE WHEN p.visitor_id IS NOT NULL THEN 1 ELSE 0 END
        ) as clicks_count
      FROM ${tableName} p
       WHERE p.business_id = '${business_id}'
      AND p.created >= '${dateStart}' AND p.created < '${dateEnd}'
      ${filters && `${filters}`}
      GROUP BY p.visitor_id, p.stored_at, p.sirge_source_name, p.visitor_name
      ${having && `${having}`}
      ${
        sort && `ORDER BY ${sort.field} ${sort.sort.toUpperCase()}`
      }, last_visited DESC
      LIMIT ${numberOfRecords} OFFSET ${offset};
      `;
    console.log({ query });
    const res = (await client.query(query)).rows;

    const { rows: rowsCount } = await client.query(
      `
        WITH cte AS (
          SELECT row_number() OVER () AS row
          FROM ${tableName} p
          WHERE p.business_id = '${business_id}'
      AND p.created >= '${dateStart}' AND p.created < '${dateEnd}'
       ${filters && `${filters}`}
      GROUP BY p.visitor_id, p.stored_at, p.sirge_source_name, p.visitor_name
      ${having && `${having}`}
      )
      SELECT MAX(row) AS count FROM cte;
      `,
    );

    client?.clean();

    return {
      data: res,
      totalRecords: rowsCount[0]?.count,
    };
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get VisitorsOfBusiness: ${err}`);

    await client?.end();

    throw err;
  }
};
export const getVisitorsOfBusinessGraph = async (
  business_id: string,
  dateStart: string,
  dateEnd: string,
) => {
  try {
    await client?.connect();
    if (!client) {
      client = await postgresConn();
      await client?.connect();
      logInfo(`Initializing a new postgres client connection`);
    }

    let query = `
      SELECT 
          TO_CHAR(p.created, 'DD-MM-YYYY') AS date, 
          COUNT(DISTINCT CASE WHEN v.min_created = p.created THEN p.visitor_id END) AS new_visitors,
          COUNT(DISTINCT CASE WHEN v.min_created < p.created THEN p.visitor_id END) AS returning_visitors
      FROM ${tableName} p
      JOIN (
          SELECT visitor_id, MIN(created) AS min_created
          FROM ${tableName}
          WHERE business_id = '${business_id}' AND created >= '${dateStart}' AND created < '${dateEnd}'
          GROUP BY visitor_id
      ) v ON p.visitor_id = v.visitor_id
      WHERE p.business_id = '${business_id}' AND p.created >= '${dateStart}' AND p.created < '${dateEnd}'
      GROUP BY TO_CHAR(p.created, 'DD-MM-YYYY')
      ORDER BY TO_CHAR(p.created, 'DD-MM-YYYY');
    `;

    const res = (await client.query(query)).rows;
    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get VisitorsOfBusinessGraph: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getVisitorDetailOfBusiness = async (
  business_id: string,
  visitor_id: string,
) => {
  try {
    await client?.connect();
    if (!client) {
      client = await postgresConn();
      await client?.connect();
      logInfo(`Initializing a new postgres client connection`);
    }

    let query = `
     SELECT 
      COALESCE(MAX(v.visitor_email), '-') AS visitor_email, 
      COALESCE(MAX(v.shipping_country), '-') AS country, 
      COALESCE(MAX(v.shipping_province), '-') AS state, 
      COALESCE(MAX(v.shipping_city), '-') AS city, 
      COUNT(*) AS total_pageviews, 
      COALESCE(MIN(v.created::text), '-') AS first_visit, 
      p.total_purchases AS total_purchases, 
      p.total_purchase_conversion_value AS total_purchase_conversion_value
    FROM page_view v
    LEFT JOIN (
      SELECT 
        visitor_id, 
        COUNT(DISTINCT order_id) AS total_purchases, 
        SUM(conversion_value) AS total_purchase_conversion_value
      FROM page_view
      WHERE business_id = '${business_id}' AND visitor_id = '${visitor_id}'
      GROUP BY visitor_id
    ) p ON v.visitor_id = p.visitor_id
    WHERE v.business_id = '${business_id}' AND v.visitor_id = '${visitor_id}'
    GROUP BY p.total_purchases, p.total_purchase_conversion_value;
    `;

    const res = (await client.query(query)).rows;
    client?.clean();

    return res?.[0];
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get VisitorDetailOfBusiness: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getVisitorDetailPageView = async (
  business_id: string,
  visitor_id: string,
  offset: number,
) => {
  try {
    await client?.connect();
    if (!client) {
      client = await postgresConn();
      await client?.connect();
      logInfo(`Initializing a new postgres client connection`);
    }

    let query = `
     SELECT *, COUNT(*) OVER() as total_records  FROM ${tableName}
     WHERE business_id = '${business_id}' AND visitor_id = '${visitor_id}'
     LIMIT 10 OFFSET ${offset};
    `;

    const res = (await client.query(query)).rows;
    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get VisitorDetailPageView: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getVisitorDetailSources = async (
  business_id: string,
  visitor_id: string,
  offset: number,
) => {
  try {
    await client?.connect();
    if (!client) {
      client = await postgresConn();
      await client?.connect();
      logInfo(`Initializing a new postgres client connection`);
    }

    let query = `
     SELECT sirge_source_name, url, COUNT(*) OVER() as total_records  FROM ${tableName}
     WHERE business_id = '${business_id}' AND visitor_id = '${visitor_id}'
     GROUP BY sirge_source_name, url
     LIMIT 10 OFFSET ${offset};
    `;

    const res = (await client.query(query)).rows;
    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get VisitorDetailSources: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getPageViewsAds = async (
  business_id: string,
  source_keys: string,
  dateStart: string,
  dateEnd: string,
  isTypeOfSelectedArray: string | null,
  selected_array?: string[] | number[],
): Promise<Ads[]> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    let query: string = '';

    if (isTypeOfSelectedArray === 'selected_campaigns') {
      query = `
      AND sirge_campaign_id IS NOT NULL 
      AND sirge_campaign_id IN ('${selected_array}') 
      AND sirge_adset_id IS NOT NULL 
      AND sirge_ad_id IS NOT NULL
    `;
    } else if (isTypeOfSelectedArray === 'selected_ad_sets') {
      query = `
      AND sirge_campaign_id IS NOT NULL 
      AND sirge_adset_id IS NOT NULL 
      AND sirge_adset_id in ('${selected_array}')  
      AND sirge_ad_id IS NOT NULL 
    `;
    } else {
      query = `
      AND sirge_campaign_id IS NOT NULL 
      AND sirge_adset_id IS NOT NULL 
      AND sirge_ad_id IS NOT NULL 
    `;
    }

    await client?.connect();
    const res = (
      await client?.query(
        `SELECT MAX(p.sirge_ad_id) as sirge_ad_id, MAX(p.ad) as ad, SUM(CASE WHEN p.order_id IS NOT NULL THEN 1 ELSE 0 END) as purchases_count,
          COUNT(DISTINCT p.visitor_id) as clicks_count, SUM(CAST(p.conversion_value as numeric)) as conversion_value
          FROM ${tableName} p
          WHERE business_id = ('${business_id}')
          AND source IN ('${source_keys}') 
          AND ad IS NOT NULL 
          ${query}
          AND p.created BETWEEN '${dateStart}' AND '${dateEnd}'
          GROUP BY sirge_ad_id${
            isTypeOfSelectedArray !== 'selected_ad_sets' && ', ad'
          };
        `,
      )
    ).rows;

    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PageViewsAds: ${err}`);

    await client?.end();

    throw err;
  }
};

export const getPageViewData = async (
  business_id: string,
  source_keys: string,
  dateStart: string,
  dateEnd: string,
  isTypeOfSelectedArray: string | null,
  selected_array?: string[] | number[],
): Promise<Performance[]> => {
  try {
    if (!client) {
      client = await postgresConn();
      logInfo(`Initializing a new postgres client connection`);
    }

    let query: string = '';

    if (isTypeOfSelectedArray === 'selected_campaigns') {
      query = `
      AND sirge_campaign_id IS NOT NULL 
      AND sirge_campaign_id IN ('${selected_array}') 
      AND sirge_adset_id IS NOT NULL 
      AND sirge_ad_id IS NOT NULL
    `;
    } else if (isTypeOfSelectedArray === 'selected_ad_sets') {
      query = `
      AND sirge_campaign_id IS NOT NULL 
      AND sirge_adset_id IS NOT NULL 
      AND sirge_adset_id in ('${selected_array}')  
      AND sirge_ad_id IS NOT NULL 
    `;
    } else {
      query = `
      AND sirge_campaign_id IS NOT NULL 
      AND sirge_adset_id IS NOT NULL 
      AND sirge_ad_id IS NOT NULL 
    `;
    }

    await client?.connect();
    const res = (
      await client?.query(
        `SELECT MAX(p.sirge_ad_id) as sirge_ad_id, MAX(p.ad) as ad, SUM(CASE WHEN p.order_id IS NOT NULL THEN 1 ELSE 0 END) as purchases_count,
          COUNT(DISTINCT p.visitor_id) as clicks_count, SUM(CAST(p.conversion_value as numeric)) as conversion_value
          FROM ${tableName} p
          WHERE business_id = ('${business_id}')
          AND source IN ('${source_keys}') 
          AND ad IS NOT NULL 
          ${query}
          AND p.created BETWEEN '${dateStart}' AND '${dateEnd}'
          GROUP BY sirge_ad_id${
            isTypeOfSelectedArray !== 'selected_ad_sets' && ', ad'
          };
        `,
      )
    ).rows;

    client?.clean();

    return res;
  } catch (error) {
    const err = error as Error;
    console.log(`Error occurred trying to get PageViewData: ${err}`);

    await client?.end();

    throw err;
  }
};

export const closeConnection = async () => {
  if (client) {
    await client.end();
    client = null;
  }
};
