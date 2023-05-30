import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import { getUserById, updateAutoScalingSetting } from '../shared/mongoDb';
import { Result } from '../shared/types';
import { logInfo } from '../shared/utils';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { buildTestEvent } from '../test/helpers/buildTestEvent';
import { StatusCodeError } from '../shared/statusCodes';
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
      name: 'auto-scaling-setting',
    },
  },
});

export type GetAutoScalingSettingParams = {};

export const handler: AppSyncResolverHandler<
  GetAutoScalingSettingParams,
  Result<null>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const userId = auth.sub;

    const user = await getUserById(userId);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const plan = user?.user_plan;
    const planCode = plan?.plan_code;

    if (planCode !== 'bolt_pro') {
      throw new StatusCodeError(158);
    }

    const { message } = await updateAutoScalingSetting({
      user_id: user?.user_id,
      auto_scale_value: user?.auto_scaling_setting ? 0 : 1,
    });

    return successResponse(null, message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<GetAutoScalingSettingParams, Result<null>>(
    handler,
    buildTestEvent<GetAutoScalingSettingParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {},
    }),
  );
}
