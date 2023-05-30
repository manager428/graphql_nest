import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessStatusByUserId,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { BusinessStatus, PageView } from '@sirge-io/sirge-utils';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import {
  Result,
  BusinessVisitor,
  VisitorGeolocation,
  PageViewNum,
} from '../shared/types';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import {
  getPageViewVisitorInfo,
  getPageViewsTotalSpent,
} from '../shared/postgresDb';
import { getShopify } from '../shared/shopify';
import { getGoogleInfo } from '../shared/google';
import { getIpInfo } from '../shared/ipapi';
require('dotenv').config();
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
      name: 'get-business-visitor',
    },
  },
});

export type GetBusinessVisitorParams = {
  business_id: string;
  visitor_id?: string;
};

export const handler: AppSyncResolverHandler<
  GetBusinessVisitorParams,
  Result<BusinessVisitor>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const { business_id, visitor_id } =
      event.arguments as GetBusinessVisitorParams;

    if (!business_id || !visitor_id) {
      throw new StatusCodeError(1);
    }

    //--get the active status ------------------------

    const business = await getBusinessStatusByUserId({
      business_id,
      user_id: user?.user_id,
      status: BusinessStatus.ACTIVE,
    });

    if (!business) {
      throw new StatusCodeError(1);
    }

    //----get visitorInfo---------------------------------

    let {
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
    } = await getPageViewVisitorInfo(business_id, visitor_id);

    let visitor_address_line = visitor_address ? visitor_address : null;
    const fullname = visitor_name ? visitor_name : visitorId;

    const total_spent_query = await getPageViewsTotalSpent(
      business_id,
      visitor_id,
    );

    let total_spent = 0 as number;
    total_spent_query.map((item: PageView) => {
      if (item.conversion_value) {
        total_spent += item.conversion_value;
      }
    });
    //----------------------------------------------------------

    let all_page_views: PageViewNum[] = [];
    let pageview_temp: PageViewNum;
    page_views.map((page_view, index) => {
      pageview_temp.data = page_view;
      pageview_temp.id = index + 1;
      all_page_views.push(pageview_temp);
    });

    let all_page_sources: PageViewNum[] = [];
    let sources_temp: PageViewNum;
    sources.map((source, index) => {
      sources_temp.data = source;
      sources_temp.id = index + 1;
      all_page_sources.push(sources_temp);
    });

    const external_platform = business.external_platform
      ? business.external_platform
      : null;
    let external_customer_url = null;

    if (business.shopify_access_token) {
      if (visitor_email) {
        const data = await getShopify(business, visitor_email);
        if (data.error || data.errors) {
          external_customer_url = null;
        } else {
          if (data.customers[0]) {
            external_customer_url = `https://${business.shopify_store_url}/admin/customers/${data.customers[0]['id']}`;
          } else {
            external_customer_url = null;
          }
        }
      }
    }
    //--------------------------------------------------------------

    let geolocation = {} as VisitorGeolocation;
    if (
      visitor_address &&
      visitor_address.line1 &&
      visitor_address.city &&
      visitor_address.province &&
      visitor_address.country
    ) {
      try {
        const data = await getGoogleInfo(visitor_address);
        const result = data['results'][0]['geometry']['location'];
        geolocation.lat = result.lat;
        geolocation.long = result.long;
        geolocation.city = visitor_address.city;
        geolocation.province = visitor_address.province;
        geolocation.country = visitor_address.country;
      } catch (error) {
        geolocation.lat = null;
        geolocation.long = null;
        geolocation.city = null;
        geolocation.province = null;
        geolocation.country = null;
      }
    } else {
      if (ip) {
        try {
          const data = await getIpInfo(ip);
          geolocation.lat = data.lat;
          geolocation.long = data.long;
          geolocation.city = visitor_address.city;
          geolocation.province = visitor_address.province;
          geolocation.country = visitor_address.country;
        } catch (error) {
          geolocation.lat = null;
          geolocation.long = null;
          geolocation.city = null;
          geolocation.province = null;
          geolocation.country = null;
        }
      } else {
        geolocation.lat = null;
        geolocation.long = null;
        geolocation.city = null;
        geolocation.province = null;
        geolocation.country = null;
      }
    }

    let object: BusinessVisitor = {
      visitor_name: fullname,
      visitor_email: visitor_email,
      visitor_phone: visitor_phone,
      visitor_address: visitor_address_line,
      sources: all_page_sources,
      page_views: all_page_views,
      total_spent: total_spent,
      total_page_views: all_page_views.length,
      total_purchases: purchases,
      external_customer_url: external_customer_url,
      external_platform: external_platform,
      geolocation: geolocation,
      first_visit: first_visit,
      total_spent_query: total_spent_query,
    };

    return successResponse<BusinessVisitor>(object);
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetBusinessVisitorParams, Result<BusinessVisitor>>(
    handler,
    buildTestEvent<GetBusinessVisitorParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc',
        visitor_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
      },
    }),
  );
}
