import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { Result } from '../shared/types';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import * as Sentry from '@sentry/serverless';
import * as AWS from 'aws-sdk';
import { StatusCodeError } from '../shared/statusCodes';
import { getBusiness, verifyUserSubscription } from '../shared/mongoDb';

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
      name: 'triggerBusinessDataLongFetch',
    },
  },
});

export interface TriggerBusinessDataLongFetchParams {
  triggerBusinessDataLongFetchInput: {
    business_id: string;
  };
}

export const handler: AppSyncResolverHandler<
  TriggerBusinessDataLongFetchParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    await verifyUserSubscription(auth);

    const {
      triggerBusinessDataLongFetchInput: { business_id },
    } = event.arguments;

    if (!business_id) {
      throw new StatusCodeError(1);
    }

    const business = await getBusiness(business_id);

    if (!business) {
      throw new StatusCodeError(1);
    }

    logInfo(`Business returned: ${JSON.stringify(business)}`);

    const cloudwatchevents = new AWS.CloudWatchEvents({
      apiVersion: '2015-10-07',
    });

    await cloudwatchevents
      .putEvents({
        Entries: [
          {
            Source: 'sirge.appsync.api',
            DetailType: 'TriggerBusinessDataLongFetch',
            Detail: JSON.stringify({
              business_id: business.business_id,
            }),
          },
        ],
      })
      .promise();

    return successResponse(null, 'Async long fetch triggered successfully.');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<TriggerBusinessDataLongFetchParams, Result<null>>(
    handler,
    buildTestEvent<TriggerBusinessDataLongFetchParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        triggerBusinessDataLongFetchInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
        },
      },
    }),
  );
}
