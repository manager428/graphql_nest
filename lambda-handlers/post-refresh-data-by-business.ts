import { RefreshDataByBusinessParams } from '../shared/types';
import { AppSyncResolverHandler } from 'aws-lambda';
import { basename } from 'path';
import { enableDebugMode } from '../lib/enableDebugMode';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { getEventName } from '../shared/getEventName';
import { Result } from '../shared/types';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
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
      name: 'post-verify-two-factor',
    },
  },
});

export const handler: AppSyncResolverHandler<
  RefreshDataByBusinessParams,
  Result<string>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const {
      refreshDataForBusinessInput: { business_id },
    } = event.arguments as RefreshDataByBusinessParams;

    return successResponse(business_id, `Business data refresh complete`);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<RefreshDataByBusinessParams, Result<string>>(
    handler,
    buildTestEvent<RefreshDataByBusinessParams>({
      userId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      group: 'Managers',
      requestPayload: {
        refreshDataForBusinessInput: {
          business_id: '6f45bcf3-e336-4195-9e52-43c4c9a6ad35',
        },
      },
    }),
  );
}
