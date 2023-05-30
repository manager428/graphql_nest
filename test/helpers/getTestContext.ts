import { Context } from 'aws-lambda';

export const getTestContext = (): Context => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: '',
  functionVersion: '',
  invokedFunctionArn: '',
  memoryLimitInMB: '',
  awsRequestId: '',
  logGroupName: '',
  logStreamName: '',
  getRemainingTimeInMillis: (): number => {
    throw new Error('Function not implemented.');
  },
  done: (error?: Error | undefined, result?: any): void => {
    throw new Error('Function not implemented.');
  },
  fail: (error: string | Error): void => {
    throw new Error('Function not implemented.');
  },
  succeed: (messageOrObject: any): void => {
    throw new Error('Function not implemented.');
  },
});
