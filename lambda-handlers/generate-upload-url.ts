import { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda';
import crypto from 'crypto';
import { enableDebugMode } from '../lib/enableDebugMode';
import {
  getBusinessStatusByUserId,
  verifyUserSubscription,
} from '../shared/mongoDb';
import { BusinessStatus } from '@sirge-io/sirge-utils';
import {
  UploadLogoParams,
  GenerateUploadUrlInput,
  Result,
} from '../shared/types';
import { uploadToS3 } from '../shared/s3';
import { logInfo } from '../shared/utils';
import { basename } from 'path';
import { getEventName } from '../shared/getEventName';
import { errorResponse } from '../shared/errorResponse';
import { successResponse } from '../shared/successResponse';
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
      name: 'generate-upload-url',
    },
  },
});

export type PresignedUploadUrlResponse = { url: string; upload_url: string };

export const handler: AppSyncResolverHandler<
  UploadLogoParams,
  Result<PresignedUploadUrlResponse>
> = Sentry.AWSLambda.wrapHandler(async (event, _context) => {
  try {
    logInfo(event, `Triggered ${getEventName(basename(__filename))} Event`);

    const auth = event.identity as AppSyncIdentityCognito;

    const { authenticatedUser: user } = await verifyUserSubscription(auth);

    if (!user) {
      throw new StatusCodeError(185);
    }

    const {
      generateUploadUrlInput: { business_id, extension_type, content_type },
    } = event.arguments as GenerateUploadUrlInput;

    if (business_id) {
      const business = await getBusinessStatusByUserId({
        business_id,
        user_id: user?.user_id,
        status: BusinessStatus.ACTIVE,
      });

      if (!business) {
        throw new StatusCodeError(1);
      }
      logInfo(`Business returned: ${JSON.stringify(business)}`);
    }

    /** S3 Upload */
    const uuid = crypto.randomUUID();
    const file_name = `${uuid}.${extension_type}`;
    const file_key = `${
      business_id ? 'business-logos' : 'profile-photos'
    }/${file_name}`;

    const params = { file_key, content_type };

    const { message, url, upload_url } = await uploadToS3(params);

    logInfo(`Presigned S3 result: ${message} - ${url} - ${upload_url}`);

    const data = { url, upload_url };

    return successResponse(data, message);
  } catch (error: unknown) {
    Sentry.captureException(error);
    return errorResponse(error, event);
  }
});

if (require.main == module) {
  enableDebugMode<UploadLogoParams, Result<PresignedUploadUrlResponse>>(
    handler,
    buildTestEvent<UploadLogoParams>({
      userId: '75ea13dd-bc85-44db-a8a6-806c6a5eff5b',
      group: 'Managers',
      requestPayload: {
        generateUploadUrlInput: {
          business_id: '62cf19a5-6e44-42e4-82cf-da139f3e61c1',
          extension_type: 'png',
          content_type: 'image/png',
        },
      },
    }),
  );
}
