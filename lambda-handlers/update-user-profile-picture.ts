import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  updateUserProfilePicById,
  verifyUserSubscription,
} from '../shared/mongoDb';
import {
  UploadLogoParams,
  UpdateUserProfilePictureInput,
  Result,
} from '../shared/types';
import { User } from '@sirge-io/sirge-utils';
import { basename } from 'path';
import { errorResponse } from '../shared/errorResponse';
import { getEventName } from '../shared/getEventName';
import { successResponse } from '../shared/successResponse';
import { logInfo } from '../shared/utils';
import { StatusCodeError } from '../shared/statusCodes';
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
      name: 'update-user-profile-picture',
    },
  },
});

export const handler: AppSyncResolverHandler<
  UploadLogoParams,
  Result<User>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const {
      updateUserProfilePictureInput: { file_url },
    } = event.arguments as UpdateUserProfilePictureInput;

    /** Update User profile picture record on the Database */
    const updatedUser = await updateUserProfilePicById({
      user_id: user?.user_id,
      file_url,
    });

    logInfo(`Updated Business Record: ${updatedUser}`);

    return successResponse(updatedUser, 'Profile photo updated successfully');
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UploadLogoParams, Result<User>>(
    handler,
    buildTestEvent<UpdateUserProfilePictureInput>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        updateUserProfilePictureInput: {
          user_id: '6daadd85-784c-45d6-a724-87dcbe43930b',
          file_url: 'https://via.placeholder.com/150',
        },
      },
    }),
  );
}
