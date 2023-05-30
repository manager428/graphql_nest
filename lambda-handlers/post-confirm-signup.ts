import { PostConfirmationTriggerHandler } from 'aws-lambda';
import * as utils from '../shared/utils';
import { addUserToGroup } from '../shared/cognito';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
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
      name: 'post-confirm-signup',
    },
  },
});

export const handler: PostConfirmationTriggerHandler =
  Sentry.AWSLambda.wrapHandler(async (event, context, callback) => {
    try {
      utils.logInfo(
        event,
        `Triggered ${getEventName(basename(__filename))} Event`,
      );
      utils.logInfo(context, 'Context');

      const params = {
        GroupName: event.request.userAttributes.manager_id
          ? 'Staff'
          : 'Managers',
        UserPoolId: event.userPoolId,
        Username: event.userName,
      };

      await addUserToGroup(params);

      return event;
    } catch (error: unknown) {
      Sentry.captureException(error);
      utils.logError(error);

      return callback(
        error instanceof Error
          ? error
          : `Caught Unknown: ${JSON.stringify(error)}`,
      );
    }
  });
