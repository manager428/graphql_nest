import AWS from 'aws-sdk';
import { GetParameterResult } from 'aws-sdk/clients/ssm';
import * as Sentry from '@sentry/serverless';

require('dotenv').config();

export async function getAwsKeys() {
  let result: { accessKey?: string; accessSecret?: string } = {
    accessKey: '',
    accessSecret: '',
  };

  try {
    const accessKeyParam = process.env.ACCESS_KEY_ID;

    const accessSecretParam = process.env.SECRET_ACCESS_KEY;

    result = { accessKey: accessKeyParam, accessSecret: accessSecretParam };

    return result;
  } catch (error) {
    console.log(`Error occured trying to fetch access keys or secrets`);
  }

  return result;
}

export async function getWriterDbConnstring() {
  let result: string | undefined = '';
  try {
    const ssm = new AWS.SSM();
    const parameter = (await ssm
      .getParameter({
        Name: 'tracking-db-writer-connstring',
        WithDecryption: true,
      })
      .promise()) as GetParameterResult;

    result = parameter?.Parameter?.Value;
  } catch (error) {
    result = '';
    Sentry.captureException(error);
  }
  return result || process.env.DB_HOST;
}

export async function getEmailSecretEncrypt() {
  let result: string | undefined = '';
  try {
    const ssm = new AWS.SSM();
    const parameter = (await ssm
      .getParameter({
        Name: 'email-token',
        WithDecryption: true,
      })
      .promise()) as GetParameterResult;

    result = parameter?.Parameter?.Value;
  } catch (error) {
    result = '';
    Sentry.captureException(error);
  }
  return result || '';
}

export async function getDbCredentials() {
  let result: { username: string | undefined; pw: string | undefined } = {
    username: '',
    pw: '',
  };
  try {
    const ssm = new AWS.SSM();
    const parameter = (await ssm
      .getParameter({
        Name: 'tracking-db-password',
        WithDecryption: true,
      })
      .promise()) as GetParameterResult;

    result.pw = parameter?.Parameter?.Value;
  } catch (error) {
    result.pw = '';
    Sentry.captureException(error);
  }

  result.username = process.env.DB_USERNAME;
  result.pw = result.pw;

  return result;
}
