#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CDKLambdaBaseStack } from '../lib/appsync-graphql-api-stack';

import { CDKContext } from '@sirge-io/sirge-utils';
import gitBranch from 'git-branch';

// Get CDK Context based on git branch
export const getContext = async (app: cdk.App): Promise<CDKContext> => {
  return new Promise(async (resolve, reject) => {
    try {
      const currentBranch = await gitBranch();

      const environment = app.node
        .tryGetContext('environments')
        .find((e: CDKContext) => e.branchName === currentBranch);

      const globals = app.node.tryGetContext('globals');

      return resolve({ ...globals, ...environment });
    } catch (error) {
      return reject();
    }
  });
};

// Create Stacks
const createStacks = async () => {
  try {
    const app = new cdk.App();
    const context = await getContext(app);

    const tags: { Environment: string; [key: string]: string } = {
      Environment: context.environment,
    };

    const stackProps: cdk.StackProps = {
      env: {
        region: context.region,
        account: context.accountNumber,
      },
      tags,
    };

    new CDKLambdaBaseStack(
      app,
      `${context.appName}-cdk-lambda-base-stack-${context.environment}`,
      stackProps,
      context,
    );
  } catch (error) {
    console.error(error);
  }
};

createStacks();
