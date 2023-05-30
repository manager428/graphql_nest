// CDK
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from '@aws-cdk/aws-appsync-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cwLogs from 'aws-cdk-lib/aws-logs';
import { getLambdaDefinitions, getFunctionProps } from './config/lambda-config';

// Types
import { CDKContext } from '@sirge-io/sirge-utils';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Architecture } from 'aws-cdk-lib/aws-lambda';
import * as CustomResources from 'aws-cdk-lib/custom-resources';
import * as Iam from 'aws-cdk-lib/aws-iam';

require('dotenv').config();

// Note: This class will create the entire appsync stack for you
export class CDKLambdaBaseStack extends Stack {
  public readonly lambdaFunctions: {
    [key: string]: NodejsFunction;
  } = {};
  constructor(
    scope: Construct,
    id: string,
    props: StackProps,
    context: CDKContext,
  ) {
    super(scope, id, props);

    /** Appsync API */

    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      'UserPool',
      context.userPoolId,
    );

    const userPoolClient = userPool.addClient('cognito-client', {
      userPoolClientName: 'userPoolClient',
      generateSecret: false,
    });

    // const userPoolGroupDefinitions = getCognitoGroupDefinitions(context);

    // for (let userGroup of userPoolGroupDefinitions) {
    //   new cognito.CfnUserPoolGroup(this, userGroup.id, {
    //     userPoolId: userPool.userPoolId,
    //     // the properties below are optional
    //     groupName: userGroup.groupName,
    //     description: userGroup.description,
    //   });
    // }

    const graphqlApi = new appsync.GraphqlApi(this, 'graphApi', {
      name: `${context.appName}-${context.environment}`,
      schema: appsync.Schema.fromAsset(`lib/schema.graphql`),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,

          userPoolConfig: {
            userPool,
            // the properties below are optional
            defaultAction: appsync.UserPoolDefaultAction.ALLOW,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
          },
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        ],
      },
    });

    // Lambda Role
    const lambdaRole = new iam.Role(this, 'lambdaRole', {
      roleName: `${context.appName}-lambda-role-${context.environment}`,
      description: `Lambda role for ${context.appName}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoPowerUser'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'),
      ],
    });

    // Attach inline policies to Lambda role
    lambdaRole.attachInlinePolicy(
      new iam.Policy(this, 'lambdaExecutionAccess', {
        policyName: 'lambdaExecutionAccess',
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ['*'],
            actions: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:DescribeLogGroups',
              'logs:DescribeLogStreams',
              'logs:PutLogEvents',
              'dynamodb:PartiQLSelect',
              'events:PutEvents',
            ],
          }),
        ],
      }),
    );

    // Lambda Layer
    const lambdaLayer = new lambda.LayerVersion(this, 'lambdaLayer', {
      code: lambda.Code.fromAsset('shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      compatibleArchitectures: [Architecture.ARM_64],
      description: `Lambda Layer for ${context.appName}`,
    });

    // Get Lambda definitions
    const lambdaDefinitions = getLambdaDefinitions(context, {
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      STRIPE_TOKEN: process.env.STRIPE_TOKEN as string,
      AWS_S3_URL: process.env.AWS_S3_URL as string,
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET as string,
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY as string,
      SEND_GRID_FROM_EMAIL: process.env.SEND_GRID_FROM_EMAIL as string,
      TIKTOK_APP_ID: process.env.TIKTOK_APP_ID as string,
      TIKTOK_APP_SECRET: process.env.TIKTOK_APP_SECRET as string,
      SENTRY_DSN: process.env.SENTRY_DSN as string,
      SENDGRID_HOST_URL: process.env.SENDGRID_HOST_URL as string,
      FB_HOST: process.env.FB_HOST as string,
      FB_SECRET_KEY: process.env.FB_SECRET_KEY as string,
      FB_CLIENT_ID: process.env.FB_CLIENT_ID as string,
      MONGO_DB_CONNSTRING: process.env.MONGO_DB_CONNSTRING as string,
      MONGO_DB_NAME: process.env.MONGO_DB_NAME as string,
      DB_HOST: process.env.DB_HOST as string,
      DB_USERNAME: process.env.DB_USERNAME as string,
      DB_PORT: process.env.DB_PORT as string,
      DB_DATABASE: process.env.DB_DATABASE as string,
    });

    // Loop through the definitions and create lambda functions
    for (const lambdaDefinition of lambdaDefinitions) {
      // Get function props based on lambda definition
      const functionProps = getFunctionProps(
        lambdaDefinition,
        lambdaRole,
        lambdaLayer,
        context,
      );

      // Lambda Function
      const lambdaFunction = new NodejsFunction(
        this,
        `${lambdaDefinition.name}-function`,
        functionProps,
      );

      this.lambdaFunctions[lambdaDefinition.name] = lambdaFunction;

      //Lambda Data Sources & Resolvers
      if (lambdaDefinition.resolverProps) {
        const { dataSourceName, typeName, fieldName } =
          lambdaDefinition.resolverProps;
        const lambdaDS = graphqlApi.addLambdaDataSource(
          dataSourceName,
          lambdaFunction,
        );
        lambdaDS.createResolver({
          typeName,
          fieldName,
        });
      }

      if (lambdaDefinition.cognitoProps) {
        new CustomResources.AwsCustomResource(this, 'UpdateUserPool', {
          resourceType: 'Custom::UpdateUserPool',
          onCreate: {
            region: this.region,
            service: 'CognitoIdentityServiceProvider',
            action: 'updateUserPool',
            parameters: {
              UserPoolId: userPool.userPoolId,
              LambdaConfig: {
                [lambdaDefinition.cognitoProps.operation]:
                  lambdaFunction.functionArn,
              },
            },
            physicalResourceId: CustomResources.PhysicalResourceId.of(
              userPool.userPoolId,
            ),
          },
          policy: CustomResources.AwsCustomResourcePolicy.fromSdkCalls({
            resources: CustomResources.AwsCustomResourcePolicy.ANY_RESOURCE,
          }),
        });

        const invokeCognitoTriggerPermission = {
          principal: new Iam.ServicePrincipal('cognito-idp.amazonaws.com'),
          sourceArn: userPool.userPoolArn,
        };

        lambdaFunction.addPermission(
          'InvokePreSignUpHandlerPermission',
          invokeCognitoTriggerPermission,
        );
      }

      // Create corresponding Log Group with one month retention
      new cwLogs.LogGroup(this, `fn-${lambdaDefinition.name}-log-group`, {
        logGroupName: `/aws/lambda/${context.appName}-${lambdaDefinition.name}-${context.environment}`,
        retention: cwLogs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      });
    }
  }
}
