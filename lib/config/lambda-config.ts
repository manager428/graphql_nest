import { Duration } from 'aws-cdk-lib';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Architecture } from 'aws-cdk-lib/aws-lambda';
import {
  CDKContext,
  LambdaDefinition,
  LambdaEnvironment,
} from '@sirge-io/sirge-utils';

// Constants
const DEFAULT_LAMBDA_MEMORY_MB = 1024;
const DEFAULT_LAMBDA_TIMEOUT_MINS = 15;

// Returns lambda definitions with custom env
export const getLambdaDefinitions = (
  _context: CDKContext,
  environment?: LambdaEnvironment,
): LambdaDefinition[] => {
  const lambdaDefinitions: LambdaDefinition[] = [
    {
      name: 'get-businesses-by-user-id',
      resolverProps: {
        dataSourceName: 'getBusinessesByUserIdDS',
        typeName: 'Query',
        fieldName: 'getBusinessesByUserId',
      },
      environment,
    },
    {
      name: 'get-user',
      resolverProps: {
        dataSourceName: 'getUserDS',
        typeName: 'Query',
        fieldName: 'getUser',
      },
      environment,
    },
    {
      name: 'register-user',
      resolverProps: {
        dataSourceName: 'registerUserDS',
        typeName: 'Mutation',
        fieldName: 'registerUser',
      },
      environment,
    },
    {
      name: 'post-request-password-link',
      resolverProps: {
        dataSourceName: 'requestpasswordresetlinkDS',
        typeName: 'Mutation',
        fieldName: 'passwordResetLink',
      },
      environment,
    },
    {
      name: 'create-staff-account',
      resolverProps: {
        dataSourceName: 'createStaffAccountDS',
        typeName: 'Mutation',
        fieldName: 'createStaffAccount',
      },
      environment,
    },
    {
      name: 'get-all-staff-accounts',
      resolverProps: {
        dataSourceName: 'getAllStaffAccountsDS',
        typeName: 'Query',
        fieldName: 'getAllStaffAccounts',
      },
      environment,
    },
    {
      name: 'update-staff-account-access',
      resolverProps: {
        dataSourceName: 'updateStaffAccountAccessDS',
        typeName: 'Mutation',
        fieldName: 'updateStaffAccountAccess',
      },
      environment,
    },
    {
      name: 'delete-staff-account',
      resolverProps: {
        dataSourceName: 'deleteStaffAccountDS',
        typeName: 'Mutation',
        fieldName: 'deleteStaffAccount',
      },
      environment,
    },
    {
      name: 'post-verify-two-factor',
      resolverProps: {
        dataSourceName: 'verifyTwoFactorDS',
        typeName: 'Mutation',
        fieldName: 'verifyTwoFactor',
      },
      environment,
    },
    {
      name: 'post-refresh-data-by-business',
      resolverProps: {
        dataSourceName: 'refreshDataByBusinessDS',
        typeName: 'Mutation',
        fieldName: 'refreshDataForBusiness',
      },
      environment,
    },
    {
      name: 'post-change-password',
      resolverProps: {
        dataSourceName: 'changePasswordDS',
        typeName: 'Mutation',
        fieldName: 'changePassword',
      },
      environment,
    },
    {
      name: 'generate-upload-url',
      resolverProps: {
        dataSourceName: 'generateUploadUrlDS',
        typeName: 'Query',
        fieldName: 'generateUploadUrl',
      },
      environment,
    },
    {
      name: 'update-business-logo',
      resolverProps: {
        dataSourceName: 'updateBusinessLogoDS',
        typeName: 'Mutation',
        fieldName: 'updateBusinessLogo',
      },
      environment,
    },
    {
      name: 'get-platform-mode',
      resolverProps: {
        dataSourceName: 'getPlatformModeDS',
        typeName: 'Query',
        fieldName: 'getPlatformMode',
      },
      environment,
    },
    {
      name: 'update-user-profile-picture',
      resolverProps: {
        dataSourceName: 'updateUserProfilePictureDS',
        typeName: 'Mutation',
        fieldName: 'updateUserProfilePicture',
      },
      environment,
    },

    {
      name: 'update-user-subscription-card',
      resolverProps: {
        dataSourceName: 'updateUserSubscriptionCardDS',
        typeName: 'Mutation',
        fieldName: 'updateUserSubscriptionCard',
      },
      environment,
    },
    {
      name: 'auto-scaling-setting',
      resolverProps: {
        dataSourceName: 'autoScalingSettingDS',
        typeName: 'Query',
        fieldName: 'autoScalingSetting',
      },
      environment,
    },
    {
      name: 'update-timezone-currency',
      resolverProps: {
        dataSourceName: 'updateTimezoneCurrencyDS',
        typeName: 'Mutation',
        fieldName: 'updateTimezoneCurrency',
      },
      environment,
    },
    {
      name: 'remove-facebook-ad-account',
      resolverProps: {
        dataSourceName: 'removeFacebookAdAccountDS',
        typeName: 'Mutation',
        fieldName: 'removeFacebookAdAccount',
      },
      environment,
    },
    {
      name: 'set-facebook-ad-account',
      resolverProps: {
        dataSourceName: 'setFacebookAdAccountDS',
        typeName: 'Mutation',
        fieldName: 'setFacebookAdAccount',
      },
      environment,
    },
    {
      name: 'activate-business',
      resolverProps: {
        dataSourceName: 'activateBusinessDS',
        typeName: 'Mutation',
        fieldName: 'activateBusiness',
      },
      environment,
    },
    {
      name: 'deactivate-business',
      resolverProps: {
        dataSourceName: 'deactivateBusinessDS',
        typeName: 'Mutation',
        fieldName: 'deactivateBusiness',
      },
      environment,
    },
    {
      name: 'create-business',
      resolverProps: {
        dataSourceName: 'createBusinessDS',
        typeName: 'Mutation',
        fieldName: 'createBusiness',
      },
      environment,
    },
    {
      name: 'get-business-by-vanity-name',
      resolverProps: {
        dataSourceName: 'getBusinessByVanityNameDS',
        typeName: 'Query',
        fieldName: 'getBusinessByVanityName',
      },
      environment,
    },
    {
      name: 'get-business-sources-by-id',
      resolverProps: {
        dataSourceName: 'getBusinessSourcesByIdDS',
        typeName: 'Query',
        fieldName: 'getBusinessSourcesById',
      },
      environment,
    },
    {
      name: 'get-subscription',
      resolverProps: {
        dataSourceName: 'getSubscriptionDS',
        typeName: 'Query',
        fieldName: 'getSubscription',
      },
      environment,
    },
    {
      name: 'end-trial',
      resolverProps: {
        dataSourceName: 'endTrialDS',
        typeName: 'Query',
        fieldName: 'endTrial',
      },
      environment,
    },
    {
      name: 'apply-promo-code',
      resolverProps: {
        dataSourceName: 'applyPromoCodeDS',
        typeName: 'Mutation',
        fieldName: 'applyPromoCode',
      },
      environment,
    },
    {
      name: 'get-credit-transactions',
      resolverProps: {
        dataSourceName: 'getCreditTransactionsDS',
        typeName: 'Query',
        fieldName: 'getCreditTransactions',
      },
      environment,
    },
    {
      name: 'pay-invoice',
      resolverProps: {
        dataSourceName: 'payInvoiceDS',
        typeName: 'Mutation',
        fieldName: 'payInvoice',
      },
      environment,
    },
    /**
     * Cognito Lambdas
     */
    {
      name: 'post-confirm-signup',
      cognitoProps: {
        operation: 'PostConfirmation',
      },
      environment: {},
    },
    {
      name: 'get-usage',
      resolverProps: {
        dataSourceName: 'getUsageDS',
        typeName: 'Query',
        fieldName: 'getUsage',
      },
      environment,
    },
    {
      name: 'get-account-integrations',
      resolverProps: {
        dataSourceName: 'getAccountIntegrationsDS',
        typeName: 'Query',
        fieldName: 'getAccountIntegrations',
      },
      environment,
    },
    {
      name: 'get-facebook-ad-accounts',
      resolverProps: {
        dataSourceName: 'getFacebookAdAccountsDS',
        typeName: 'Query',
        fieldName: 'getFacebookAdAccounts',
      },
      environment,
    },
    {
      name: 'set-facebook-user-access',
      resolverProps: {
        dataSourceName: 'setFacebookUserAccessDS',
        typeName: 'Mutation',
        fieldName: 'setFacebookUserAccess',
      },
      environment,
    },
    {
      name: 'remove-facebook-user-access',
      resolverProps: {
        dataSourceName: 'removeFacebookUserAccessDS',
        typeName: 'Mutation',
        fieldName: 'removeFacebookUserAccess',
      },
      environment,
    },
    {
      name: 'get-invoices',
      resolverProps: {
        dataSourceName: 'getInvoicesDS',
        typeName: 'Query',
        fieldName: 'getInvoices',
      },
      environment,
    },
    {
      name: 'subscribe',
      resolverProps: {
        dataSourceName: 'subscribeDS',
        typeName: 'Mutation',
        fieldName: 'subscribe',
      },
      environment,
    },
    {
      name: 'update-subscription-item-quantity',
      resolverProps: {
        dataSourceName: 'updateSubscriptionItemQuantityDS',
        typeName: 'Mutation',
        fieldName: 'updateSubscriptionItemQuantity',
      },
      environment,
    },
    {
      name: 'get-current-user-sessions',
      resolverProps: {
        dataSourceName: 'getCurrentUserSessionsDS',
        typeName: 'Query',
        fieldName: 'getCurrentUserSessions',
      },
      environment,
    },
    {
      name: 'get-business-trackerstatus',
      resolverProps: {
        dataSourceName: 'getBusinessTrackerStatusDS',
        typeName: 'Query',
        fieldName: 'getBusinessTrackerStatus',
      },
      environment,
    },
    {
      name: 'get-all-business-ads',
      resolverProps: {
        dataSourceName: 'getAllBusinessAdsDS',
        typeName: 'Query',
        fieldName: 'getAllBusinessAds',
      },
      environment,
    },
    {
      name: 'get-business-ad-sets',
      resolverProps: {
        dataSourceName: 'getBusinessAdSetsDS',
        typeName: 'Query',
        fieldName: 'getBusinessAdSets',
      },
      environment,
    },
    {
      name: 'get-all-visitors',
      resolverProps: {
        dataSourceName: 'getAllVisitorsDS',
        typeName: 'Query',
        fieldName: 'getAllVisitors',
      },
      environment,
    },
    {
      name: 'get-all-visitors-mongo',
      resolverProps: {
        dataSourceName: 'getAllVisitorsMongoDS',
        typeName: 'Query',
        fieldName: 'getAllVisitorsMongo',
      },
      environment,
    },
    {
      name: 'get-all-visitors-graph',
      resolverProps: {
        dataSourceName: 'getAllVisitorsGraphDS',
        typeName: 'Query',
        fieldName: 'getAllVisitorsGraph',
      },
      environment,
    },
    {
      name: 'get-all-visitors-graph-mongo',
      resolverProps: {
        dataSourceName: 'getAllVisitorsGraphMongoDS',
        typeName: 'Query',
        fieldName: 'getAllVisitorsGraphMongo',
      },
      environment,
    },
    {
      name: 'get-visitor-detail',
      resolverProps: {
        dataSourceName: 'getVisitorDetailDS',
        typeName: 'Query',
        fieldName: 'getVisitorDetail',
      },
      environment,
    },
    {
      name: 'get-visitor-detail-pageview',
      resolverProps: {
        dataSourceName: 'getVisitorDetailPageviewDS',
        typeName: 'Query',
        fieldName: 'getVisitorDetailPageview',
      },
      environment,
    },
    {
      name: 'get-visitor-detail-sources',
      resolverProps: {
        dataSourceName: 'getVisitorDetailSourcesDS',
        typeName: 'Query',
        fieldName: 'getVisitorDetailSources',
      },
      environment,
    },
    {
      name: 'get-business-visitor',
      resolverProps: {
        dataSourceName: 'getBusinessVisitorDS',
        typeName: 'Query',
        fieldName: 'getBusinessVisitor',
      },
      environment,
    },
    {
      name: 'get-business-by-businessid',
      resolverProps: {
        dataSourceName: 'getBusinessByBusinessIdDS',
        typeName: 'Query',
        fieldName: 'getBusinessByBusinessId',
      },
      environment,
    },
    {
      name: 'update-business-by-businessid',
      resolverProps: {
        dataSourceName: 'updateBusinessByBusinessIdDS',
        typeName: 'Mutation',
        fieldName: 'updateBusinessByBusinessId',
      },
      environment,
    },
    {
      name: 'update-facebook-ad-status',
      resolverProps: {
        dataSourceName: 'updateFacebookAdStatusDS',
        typeName: 'Mutation',
        fieldName: 'updateFacebookAdStatus',
      },
      environment,
    },
    {
      name: 'delete-business-by-businessid',
      resolverProps: {
        dataSourceName: 'deleteBusinessByBusinessIdDS',
        typeName: 'Mutation',
        fieldName: 'deleteBusinessByBusinessId',
      },
      environment,
    },
    {
      name: 'get-purchase-by-pageviewid',
      resolverProps: {
        dataSourceName: 'getPurchaseByPageViewIdDS',
        typeName: 'Query',
        fieldName: 'getPurchaseByPageViewId',
      },
      environment,
    },
    {
      name: 'update-user',
      resolverProps: {
        dataSourceName: 'updateUserDS',
        typeName: 'Mutation',
        fieldName: 'updateUser',
      },
      environment,
    },
    {
      name: 'update-subscription-plan',
      resolverProps: {
        dataSourceName: 'updateSubscriptionPlanDS',
        typeName: 'Mutation',
        fieldName: 'updateSubscriptionPlan',
      },
      environment,
    },
    {
      name: 'get-performance-details',
      resolverProps: {
        dataSourceName: 'getPerformanceDetailsDS',
        typeName: 'Query',
        fieldName: 'getPerformanceDetails',
      },
      environment,
    },
    {
      name: 'get-staff-byId',
      resolverProps: {
        dataSourceName: 'getStaffByIdDS',
        typeName: 'Query',
        fieldName: 'getStaffById',
      },
      environment,
    },
    {
      name: 'authenticate-tik-tok',
      resolverProps: {
        dataSourceName: 'authenticateTikTokDS',
        typeName: 'Mutation',
        fieldName: 'authenticateTikTok',
      },
      environment,
    },
    {
      name: 'disconnect-tik-tok',
      resolverProps: {
        dataSourceName: 'disconnectTikTokDS',
        typeName: 'Mutation',
        fieldName: 'disconnectTikTok',
      },
      environment,
    },
    {
      name: 'get-business-connections',
      resolverProps: {
        dataSourceName: 'getBusinessConnectionsDS',
        typeName: 'Query',
        fieldName: 'getBusinessConnections',
      },
      environment,
    },
    {
      name: 'get-purchases-by-business',
      resolverProps: {
        dataSourceName: 'getPurchasesByBusinessDS',
        typeName: 'Query',
        fieldName: 'getPurchasesByBusiness',
      },
    },
    {
      name: 'update-shopify-store-url',
      resolverProps: {
        dataSourceName: 'updateShopifyStoreUrlDS',
        typeName: 'Mutation',
        fieldName: 'updateShopifyStoreUrl',
      },
      environment,
    },
    {
      name: 'set-tiktok-ad-account',
      resolverProps: {
        dataSourceName: 'setTiktokAdAccountDS',
        typeName: 'Mutation',
        fieldName: 'setTiktokAdAccount',
      },
      environment,
    },
    {
      name: 'disconnect-business-tik-tok',
      resolverProps: {
        dataSourceName: 'disconnectBusinessTiktokDS',
        typeName: 'Mutation',
        fieldName: 'disconnectBusinessTiktok',
      },
      environment,
    },
    {
      name: 'get-user-tik-tok-ads',
      resolverProps: {
        dataSourceName: 'getUserTiktokAdsDS',
        typeName: 'Query',
        fieldName: 'getUserTiktokAds',
      },
      environment,
    },
    {
      name: 'get-current-user-business-details',
      resolverProps: {
        dataSourceName: 'getCurrentUserBusinessDetailsDS',
        typeName: 'Query',
        fieldName: 'getCurrentUserBusinessDetails',
      },
      environment,
    },
    {
      name: 'get-business-analytics',
      resolverProps: {
        dataSourceName: 'getBusinessAnalyticsDS',
        typeName: 'Query',
        fieldName: 'getBusinessAnalytics',
      },
      environment,
    },
    {
      name: 'get-business-campaigns',
      resolverProps: {
        dataSourceName: 'getBusinessCampaignsDS',
        typeName: 'Query',
        fieldName: 'getBusinessCampaigns',
      },
      environment,
    },

    {
      name: 'trigger-business-data-long-fetch',
      resolverProps: {
        dataSourceName: 'triggerBusinessDataLongFetchDS',
        typeName: 'Mutation',
        fieldName: 'triggerBusinessDataLongFetch',
      },
      environment,
    },

    {
      name: 'update-monthly-budget',
      resolverProps: {
        dataSourceName: 'updateMonthlyBudgetDS',
        typeName: 'Mutation',
        fieldName: 'updateMonthlyBudget',
      },
      environment,
    },
    {
      name: 'update-roas-goals',
      resolverProps: {
        dataSourceName: 'updateRoasGoalsDS',
        typeName: 'Mutation',
        fieldName: 'updateRoasGoals',
      },
      environment,
    },
  ];
  return lambdaDefinitions;
};

// Returns Lambda Function properties with defaults and overwrites
export const getFunctionProps = (
  lambdaDefinition: LambdaDefinition,
  lambdaRole: iam.Role,
  lambdaLayer: lambda.LayerVersion,
  context: CDKContext,
): NodejsFunctionProps => {
  const functionProps: NodejsFunctionProps = {
    functionName: `${context.appName}-${lambdaDefinition.name}-${context.environment}`,
    entry: `lambda-handlers/${lambdaDefinition.name}.ts`,
    runtime: lambda.Runtime.NODEJS_18_X,
    architecture: Architecture.ARM_64,
    memorySize: lambdaDefinition.memoryMB
      ? lambdaDefinition.memoryMB
      : DEFAULT_LAMBDA_MEMORY_MB,
    timeout: lambdaDefinition.timeoutMins
      ? Duration.minutes(lambdaDefinition.timeoutMins)
      : Duration.minutes(DEFAULT_LAMBDA_TIMEOUT_MINS),
    environment: lambdaDefinition.environment,
    role: lambdaRole,
    layers: [lambdaLayer],
    bundling: {
      // pg-native is not available and won't be used. This is letting the
      // bundler (esbuild) know pg-native won't be included in the bundled JS
      // file.
      externalModules: ['pg-native'],
    },
  };
  return functionProps;
};
