import {
  AppSyncResolverEvent,
  AppSyncResolverHandler,
  Callback,
  Context,
} from 'aws-lambda';
import AWS from 'aws-sdk';
import { logInfo } from '../shared/utils';

export const enableDebugMode = <T, R>(
  handler: AppSyncResolverHandler<T, R | null, Record<string, any> | null>,
  eventData: AppSyncResolverEvent<T, Record<string, any> | null>,
) => {
  logInfo('Debugging mode');

  require('dotenv').config();

  if (process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
    AWS.config.update({
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
      region: 'us-west-2',
    });
  }

  handler(eventData, {} as Context, {} as Callback<R | null>);
};
