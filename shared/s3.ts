import AWS from 'aws-sdk';
import { S3PresignParams } from '../shared/types';

require('dotenv').config();

type uploadToS3 = {
  file_key: string;
  content_type: string;
};

AWS.config.update({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-west-2',
  signatureVersion: 'v4',
});

const s3 = new AWS.S3();

export const uploadToS3 = async ({
  file_key,
  content_type,
}: uploadToS3): Promise<{
  message: string;
  bucket: string;
  key: string;
  region: string;
  url: string;
  upload_url: string;
}> => {
  try {
    const params: S3PresignParams = {
      Bucket: process.env.AWS_S3_BUCKET as string,
      Key: file_key,
      Expires: 3600,
      ContentType: content_type,
      ACL: 'public-read',
    };

    return {
      message: 'Presigned URL successfully created',
      bucket: params.Bucket,
      key: params.Key,
      region: process.env.AWS_REGION || 'us-west-2',
      url: `${process.env.AWS_S3_URL}/${params.Key}`,
      upload_url: s3.getSignedUrl('putObject', params),
    };
  } catch (error) {
    console.log(
      'Error occurred when trying to upload JSON document to s3 ',
      error,
    );
    throw error;
  }
};
