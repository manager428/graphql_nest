import { TikTokSourceKeys } from './../shared/enums/tikTokSourceKeys';
import { StatusCodeError } from '../shared/statusCodes';
import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { verifyUserSubscription } from '../shared/mongoDb';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { MarketingSources, PageView } from '@sirge-io/sirge-utils';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { getPurchasesOfBusiness } from '../shared/postgresDb';
import { getFormatDate } from '../shared/time';
import { Result } from '../shared/types';
import { FacebookSourceKeys } from '../shared/enums/facebookSources';
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
      name: 'get-purchases-by-business',
    },
  },
});

export type TypePurchases = 'campaigns' | 'ad_sets' | 'ads';

export type GetPurchaseByBusinessInput = {
  business_id: string;
  date_from: string;
  date_to: string;
  source: MarketingSources;
  typePurchases: TypePurchases;
  selecte_ids: number[];
};

export type GetPurchaseByBusinessParams = {
  getPurchaseByBusinessInput: GetPurchaseByBusinessInput;
};

export const handler: AppSyncResolverHandler<
  GetPurchaseByBusinessParams,
  Result<PageView[]>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser } = await verifyUserSubscription(auth);

    if (!authenticatedUser?.subscription.status) {
      throw new StatusCodeError(88);
    }

    const {
      business_id,
      date_from,
      date_to,
      selecte_ids,
      source,
      typePurchases,
    } = event.arguments
      .getPurchaseByBusinessInput as GetPurchaseByBusinessInput;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    let format_date_from = getFormatDate(date_from as string, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    let format_date_to = getFormatDate(date_to as string, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const all_purchases = await getPurchasesOfBusiness(
      business_id,
      format_date_from,
      format_date_to,
      typePurchases,
      source === MarketingSources.FACEBOOK
        ? Object.keys(FacebookSourceKeys).filter((v) => isNaN(Number(v)))
        : Object.keys(TikTokSourceKeys).filter((v) => isNaN(Number(v))),
      selecte_ids,
    );

    logInfo(`Business Visitor returned: ${JSON.stringify(all_purchases)}`);

    return successResponse(all_purchases.rows, 'Purcharses returned');
  } catch (error) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

//This is added to support local debugging with the vscode debugger
if (require.main == module) {
  enableDebugMode<GetPurchaseByBusinessParams, Result<PageView[]>>(
    handler,
    buildTestEvent<GetPurchaseByBusinessParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getPurchaseByBusinessInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
          date_from: '2022-06-04',
          date_to: '2022-12-04',
          source: MarketingSources.FACEBOOK,
          typePurchases: 'campaigns',
          selecte_ids: [23851363086610761, 5, 24],
        },
      },
    }),
  );
}
