import AWS from 'aws-sdk';
import { marshall } from '@aws-sdk/util-dynamodb';

import { MongoClient } from 'mongodb';
import {
  UserInput,
  StaffAccountInput,
  UpdateTimezoneCurrencyInput,
  UpdateAutoScalingSettingInput,
  UpdateBusinessParams,
  CountBusinessByStatusInput,
  GetBusinessByVanityName,
  GetBusinessParams,
  SaveNewBusinessInput,
  SetFacebookUserAccessInput,
  RemoveFacebookAdAccountInput,
  UserSession,
  UserSubscriptionInput,
  UpdateUserSubscriptionCardInput,
  UpdateFacebookConnectionSettingsInput,
  PurchaseView,
  OrderResult,
  UpdateMonthlyBudgetInput,
  UpdateRoasGoalsInput,
  filterConditionType,
  PerformanceSortObjectType,
  SourcesSortObjectType,
  FieldSourcesSortType,
} from './types';

import {
  AccessKeys,
  Business,
  Plan,
  User,
  PlatformSettings,
  BusinessAccess,
  SubscriptionStatuses,
  BusinessStatus,
  EventLog,
  ExchangeRate,
  BusinessConnections,
  TwoFactor,
  Performance,
  Analytics,
} from '@sirge-io/sirge-types';
import { AppSyncIdentityCognito } from 'aws-lambda';
import { unmarshaller } from './unmarshaller';
import { UpdateStaffAccountAccessInput } from '../lambda-handlers/update-staff-account-access';
import Stripe from 'stripe';
import { logInfo } from './utils';
import {
  createStripeCustomer,
  createStripeSubscription,
  updateCard,
} from './stripe';
import { StatusCodeError, statusCodes } from './statusCodes';
import { getFormatDate } from './time';
import crypto from 'crypto';
import {
  SortObjectType,
  VisitorDetail,
  GetVisitorsOfBusinessResponse,
  VisitorsAggregate,
  VisitorsAggregateData,
} from '../lambda-handlers/get-all-visitors-dynamo';
// import { PerformanceCampaign } from '@sirge-io/sirge-types/dist/interfaces/performance';
import { PageView } from '@sirge-io/sirge-utils';
import * as Sentry from '@sentry/serverless';
import { AttributeMap } from 'aws-sdk/clients/dynamodb';
import {
  DynamoDB,
  DynamoDBClient,
  DynamoDBPaginationConfiguration,
  paginateQuery,
  QueryCommandInput,
} from '@aws-sdk/client-dynamodb';

const keys: AccessKeys = {};

const setConfig = async () => {
  try {
    //These should only ever be defined in a .env for local development.
    //If they are defined this AWS.config.update needs to run to set the role that the lambda should access dynamoDB under
    if (process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
      keys.accessKey = process.env.ACCESS_KEY_ID;
      keys.accessSecret = process.env.SECRET_ACCESS_KEY;

      AWS.config.update({
        accessKeyId: keys.accessKey,
        secretAccessKey: keys.accessSecret,
        region: 'us-west-2',
      });
    }
  } catch (error) {
    console.error(`Unable to obtain credential access keys: ${error}`);
  }
};

export const getBusiness = async (id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "business_id" = '${id}'`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new StatusCodeError(3);
    }

    const business = unmarshaller<Business>(item);

    return business;
  } catch (error) {
    console.error(`Error occurred trying to lookup business: ${id} ${error}`);
    throw error;
  }
};

export const getBusinessEventLogByBusinessIds = async (
  businessId: string[],
): Promise<EventLog[]> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "event_log" WHERE "business_id" IN (${businessId})`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const items = results?.Items;

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const eventLogs =
      items?.map((eventLog) => unmarshaller<EventLog>(eventLog)) || [];

    return eventLogs;
  } catch (error) {
    console.log(
      `Error occurred trying to lookup business: ${businessId} ${error}`,
    );
    throw error;
  }
};

export const getActiveBusinessesByBusinessId = async (businessId: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "business_id" = '${businessId}' AND "status" = 'active'`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const items = results?.Items || [];

    const businesses = items?.map((item) => unmarshaller<Business>(item));

    return businesses;
  } catch (error) {
    console.error(
      `Error occurred trying to lookup active businesses: ${error}`,
    );
    throw error;
  }
};

export const getBusinessEventLogByDateRange = async (
  businessIds: string[],
  startDate: number,
  endDate: number,
): Promise<EventLog[]> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT business_id FROM "event_log" WHERE "business_id" IN (${businessIds}) AND "created" BETWEEN ${
      startDate / 1000
    } AND ${endDate / 1000}`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const items = results?.Items;

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const eventLogs =
      items?.map((eventLog) => unmarshaller<EventLog>(eventLog)) || [];

    return eventLogs;
  } catch (error) {
    console.log(
      `Error occurred trying to lookup business: ${businessIds.join(
        ',',
      )} ${error}`,
    );
    throw error;
  }
};

export const updateUserSubscriptionCard = async (
  user: User,
  input: UpdateUserSubscriptionCardInput,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const stripe_customer_id =
      user.subscription.customer_id ?? user.stripe_customer_id;

    if (input.payment_method) {
      await updateCard(stripe_customer_id, input.payment_method);
    }

    const params: AWS.DynamoDB.UpdateItemInput = {
      TableName: 'users',
      Key: { user_id: { S: user.user_id } },
      UpdateExpression:
        'set card_last_four_digits = :clfd, card_expiry_date = :ced, card_type = :ct',
      ExpressionAttributeValues: marshall({
        ':clfd': input.card_last_four_digits,
        ':ced': input.card_expiry_date,
        ':ct': input.card_type,
      }),
    };

    await dynamoDB.updateItem(params).promise();
  } catch (error) {
    console.error(
      `Error occurred trying to update card for user: ${user.email} ${error}`,
    );
    throw error;
  }
};

export const updateFacebookConnectionSettings = async (
  user: User,
  input: UpdateFacebookConnectionSettingsInput,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "business_id" = '${input.business_id}' AND "user_id" = '${user.user_id}' AND "status" = 'active'`;

    const businessQueryResult = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    if (!businessQueryResult.Items?.[0]) {
      throw new StatusCodeError(1);
    }

    const business = <Business>unmarshaller(businessQueryResult.Items[0]);

    const params: AWS.DynamoDB.UpdateItemInput = {
      TableName: 'businesses',
      Key: { business_id: { S: business.business_id } },
      UpdateExpression: 'set fb_pixel_id = :fpid',
      ExpressionAttributeValues: marshall({
        ':fpid': input.fb_pixel_id,
      }),
    };

    await dynamoDB.updateItem(params).promise();
  } catch (error) {
    console.error(
      `Error occurred trying to facebook connection settings for user: ${user.email} ${error}`,
    );
    throw error;
  }
};

export const getBusinessStatusByUserId = async (
  params: GetBusinessParams['getBusinessStatusInput'],
) => {
  const { user_id, business_id, status } = params!;

  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" 
      WHERE "user_id" = '${user_id}' 
      AND "business_id" = '${business_id}'
      AND "status" = '${status}' 
    `;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new StatusCodeError(3);
    }

    const business = unmarshaller<Business>(item);

    return business;
  } catch (error) {
    console.log(
      `Error occurred trying to lookup business: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const updateBusinessByName = async (
  business_id: string,
  business_name: string | undefined,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `UPDATE "businesses" SET "business_name" = '${business_name}' WHERE "business_id" = '${business_id}'`;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    const business = await getBusiness(business_id);

    logInfo(`db is updated: ${business}`);

    return business;
  } catch (error) {
    console.log(
      `Error occurred trying to update business with id: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const updateBusinessLogoById = async ({
  file_url,
  business_id,
}: {
  file_url: string;
  business_id: string;
}) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `UPDATE "businesses" SET "logo" = '${file_url}' WHERE "business_id" = '${business_id}'`;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    const business = await getBusiness(business_id);

    logInfo(`db is updated: ${business}`);

    return business;
  } catch (error) {
    console.log(
      `Error occurred trying to update business with id: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const getUserByEmail = async (email: string): Promise<User> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "users" WHERE "email" = '${email}'`;

    console.info(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    console.info(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new Error(`No user was found for email ${email}`);
    }

    const user = unmarshaller<User>(item);

    return user;
  } catch (error) {
    console.error(`Error occurred trying to lookup user: ${email} ${error}`);
    throw error;
  }
};

export const getUserByUserId = async (userId: string): Promise<User> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "users" WHERE "user_id" = '${userId}'`;

    console.info(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    console.info(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new Error(`No user was found for userId ${userId}`);
    }

    const user = unmarshaller<User>(item);

    return user;
  } catch (error) {
    console.error(`Error occurred trying to lookup user: ${userId} ${error}`);
    throw error;
  }
};

export const getBusinessesByUserId = async (
  userId: string,
): Promise<Business[]> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "user_id" = '${userId}'`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const items = results?.Items ?? [];

    const businesses = items.map((business) =>
      unmarshaller<Business>(business),
    );

    return businesses;
  } catch (error) {
    console.error(`Error occurred trying to lookup user: ${userId} - ${error}`);
    throw error;
  }
};

export const getUserById = async (userId: string): Promise<User> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "users" WHERE "user_id" = '${userId}'`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new Error(`No user was found for user ID ${userId}`);
    }

    const user = unmarshaller<User>(item);

    return user;
  } catch (error) {
    console.error(`Error occurred trying to lookup user: ${userId} - ${error}`);
    throw error;
  }
};

export const getAllStaffAccounts = async (
  managerId: string,
): Promise<User[]> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "users" WHERE "manager_id" = '${managerId}'`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    if (!results?.Items?.length) {
      throw new Error(`No user was found for manager ID ${managerId}`);
    }

    const staffAccounts = results?.Items?.map((item) =>
      unmarshaller<User>(item),
    );

    return staffAccounts;
  } catch (error) {
    console.error(
      `Error occurred trying to lookup user: ${managerId} - ${error}`,
    );
    throw error;
  }
};

type VerificationResult = {
  authenticatedUser?: User;
  managingUser?: User;
  isManager?: boolean;
  isStaff?: boolean;
};

export const verifyUserSubscription = async (
  auth: AppSyncIdentityCognito,
): Promise<VerificationResult> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const isManager = auth?.groups?.includes('Managers');
    const isStaff = auth?.groups?.includes('Staff');

    let managingUser: User | undefined;

    const userId = auth.sub;

    const userResult = await dynamoDB
      .executeStatement({
        Statement: `SELECT * FROM "users" WHERE "user_id" = '${userId}'`,
      })
      .promise();

    const dynamoUser = userResult?.Items?.[0];

    if (!dynamoUser) {
      throw new Error(`No user was found for sub:${userId}`);
    }
    const authenticatedUser = unmarshaller<User>(dynamoUser);

    if (isManager) {
      const subscriptionId =
        authenticatedUser?.subscription_id ||
        authenticatedUser?.subscription?.id;

      if (!subscriptionId) {
        throw new StatusCodeError(31);
      }

      const subscriptionStatus =
        authenticatedUser?.subscription_status ||
        authenticatedUser?.subscription?.status;

      if (
        ![SubscriptionStatuses.ACTIVE, SubscriptionStatuses.TRIALING].includes(
          subscriptionStatus,
        )
      ) {
        throw new StatusCodeError(88);
      }
    } else {
      const managerUserId = auth.claims.manager_id;

      const userResults = await dynamoDB
        .executeStatement({
          Statement: `SELECT * FROM "users" WHERE "user_id" = '${managerUserId}'`,
        })
        .promise();

      const dynamoUser = userResults?.Items?.[0];

      if (!dynamoUser) {
        throw new Error(`No user was found for sub:${managerUserId}`);
      }

      managingUser = unmarshaller<User>(dynamoUser);

      const subscriptionId =
        managingUser?.subscription_id || managingUser?.subscription?.id;

      if (!subscriptionId) {
        throw new StatusCodeError(31);
      }

      const subscriptionStatus =
        managingUser.subscription_status || managingUser?.subscription?.status;

      if (![SubscriptionStatuses.ACTIVE].includes(subscriptionStatus)) {
        throw new StatusCodeError(88);
      }
    }

    return {
      authenticatedUser,
      isManager,
      isStaff,
      managingUser,
    };
  } catch (error) {
    console.error(`Error occurred trying to verify subscription - ${error}`);
    throw error;
  }
};

export const saveDynamoUser = async (
  registerUserInput: UserInput,
  cognitoUser: AWS.CognitoIdentityServiceProvider.SignUpResponse,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "users" WHERE "email" = '${registerUserInput.email}'`;

    const checkUserExists = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    if (checkUserExists.Items?.[0]) {
      throw new Error('User already exists');
    }

    const newUserId = cognitoUser.UserSub;

    // let page_view_limit: number | undefined,
    //   business_limit: number | undefined,
    //   staff_limit: number | undefined,
    //   plan_price_id: string | undefined,
    //   plan_product_id: string | undefined, // [TODO] Unused. Should it be?
    //   stripe_customer_id: string | undefined,
    //   subscription: Stripe.Subscription | undefined;

    // if (registerUserInput.payment_method) {
    //   const customer = await createStripeCustomer({
    //     email: registerUserInput.email,
    //     name: `${registerUserInput.first_name} ${registerUserInput.last_name}`,
    //     description: `Sirge Customer # ${newUserId}`,
    //     metadata: {
    //       sirge_id: newUserId,
    //     }
    //     address: {
    //       city: registerUserInput.city,
    //       country: registerUserInput.country_code,
    //       line1: registerUserInput.line1,
    //       state: registerUserInput.state,
    //       postal_code: registerUserInput.postal_code,
    //     },
    //     payment_method: registerUserInput.payment_method,
    //     invoice_settings: {
    //       default_payment_method: registerUserInput.payment_method,
    //     },
    //   });

    //   stripe_customer_id = customer.id;

    //   // ///Retrieve Plan Info

    //   const { selectedPlanJson } = await getPlanByPlanCode(
    //     registerUserInput.plan_code,
    //   );

    //   ({
    //     page_view_limit,
    //     business_limit,
    //     staff_limit,
    //     plan_price_id,
    //     plan_product_id,
    //   } = selectedPlanJson);

    //   const subscriptionItems = [{ price: plan_price_id, quantity: 1 }];

    //   const SECONDS_IN_14_DAYS = 14 * 24 * 60 * 60;

    //   const trialEndDateTime =
    //     Math.floor(Date.now() / 1000) + SECONDS_IN_14_DAYS;

    //   subscription = await createStripeSubscription({
    //     customer: stripe_customer_id,
    //     trial_end: trialEndDateTime,
    //     automatic_tax: { enabled: true },
    //     collection_method: 'charge_automatically',
    //     payment_behavior: 'error_if_incomplete',
    //     items: subscriptionItems,
    //   });
    // }

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'users',
      Item: marshall(
        {
          user_id: newUserId,
          first_name: registerUserInput.first_name,
          last_name: registerUserInput.last_name,
          email: registerUserInput.email,
          shopify_store_url: registerUserInput.shopify_store_url,
        },
        { removeUndefinedValues: true },
      ),
      ReturnValues: 'ALL_OLD',
    };

    const dynamoUser = await dynamoDB.putItem(params).promise();

    return dynamoUser;
  } catch (error) {
    console.error(
      `Error occurred trying to register user in db: ${registerUserInput.email} ${error}`,
    );
    throw error;
  }
};

export const createTwoFactor = async (user_id: string, email: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const pinCode = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 10),
    ).join('');

    //create a new two_factor record in the db tied to user_id
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const twoFactor: TwoFactor = {
      user_id: user_id,
      expiring_at: expiresAt.getTime(),
      code: pinCode.toString(),
      id: crypto.randomUUID(),
    };

    const dynamoDB = new AWS.DynamoDB();

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'two_factor',
      Item: marshall({
        ...twoFactor,
        created_at: new Date().getTime(),
      }),
    };

    const dynamoTwoFactor = await dynamoDB.putItem(params).promise();

    if (dynamoTwoFactor.$response.error) {
      throw new Error(dynamoTwoFactor?.$response?.error.message);
    }

    return twoFactor.id;
  } catch (error) {
    console.log(
      `Error occurred trying to create new two_factor record in db: ${email} ${error}`,
    );
    throw error;
  }
};

export const saveStaffAccount = async (
  registerUserInput: StaffAccountInput,
  cognitoUser: AWS.CognitoIdentityServiceProvider.SignUpResponse,
  managerId: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'users',
      Item: {
        first_name: { S: registerUserInput.first_name },
        last_name: { S: registerUserInput.last_name },
        user_id: { S: cognitoUser.UserSub },
        manager_id: { S: managerId },
      },
    };

    const dynamoUser = await dynamoDB.putItem(params).promise();

    return dynamoUser;
  } catch (error) {
    console.log(
      `Error occurred trying to register staff user in db: ${registerUserInput.email} ${error}`,
    );
    throw error;
  }
};

export const updateUserFacebookAccessDetails = async ({
  user,
  facebook_userID,
  facebook_accessToken,
}: SetFacebookUserAccessInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'users',
      Item: marshall({
        ...user,
        facebook_userID,
        facebook_accessToken,
      }),
    };

    const dynamoUser = await dynamoDB.putItem(params).promise();

    return dynamoUser;
  } catch (error) {
    console.log(
      `Error occurred trying to update user facebook access: ${user.user_id} ${error}`,
    );
    throw error;
  }
};

export const getPlatformSettings = async () => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "platform_settings"`;

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new StatusCodeError(75);
    }

    const platformSettings = unmarshaller<PlatformSettings>(item);
    const message = 'Platform settings fetched successfully';

    return { platformSettings, message };
  } catch (error) {
    console.log(
      `Error occurred trying to get platform settings data: ${error}`,
    );
    throw error;
  }
};

export const updateUserProfilePicById = async ({
  file_url,
  user_id,
}: {
  file_url: string;
  user_id: string;
}) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `UPDATE "users" SET "profile_photo" = '${file_url}' WHERE "user_id" = '${user_id}'`;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    const user = await getUserById(user_id);

    logInfo(`db is updated: ${user}`);

    return user;
  } catch (error) {
    console.log(
      `Error occurred trying to update user with id: ${user_id} ${error}`,
    );
    throw error;
  }
};

export const updateStaffAccountAccess = async (
  updateStaffAccountAccessInput: UpdateStaffAccountAccessInput,
  managerId: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const staffAccount = await dynamoDB
      .executeStatement({
        Statement: `SELECT * FROM "users" WHERE "user_id" = '${updateStaffAccountAccessInput.staff_id}' and "manager_id" = '${managerId}'`,
      })
      .promise();

    const item = staffAccount.Items?.[0];

    if (!item) {
      throw new Error('Staff account not found');
    }

    const staffAccountJson = unmarshaller<User>(item);

    const hasAccess = staffAccountJson.business_access?.find(
      (item) => item.vanity_name === updateStaffAccountAccessInput.vanity_name,
    );

    if (hasAccess) {
      /**
       * Remove Access if the staff already has it.
       */
      const updatedAccess =
        staffAccountJson.business_access?.filter(
          (item) =>
            item.vanity_name !== updateStaffAccountAccessInput.vanity_name,
        ) ?? [];

      staffAccountJson.business_access = updatedAccess;
    } else {
      const accessItem = {
        vanity_name: updateStaffAccountAccessInput.vanity_name,
      };

      const updatedAccess: BusinessAccess[] = staffAccountJson.business_access
        ? [...staffAccountJson.business_access, accessItem]
        : [accessItem];

      staffAccountJson.business_access = updatedAccess;
    }

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'users',
      Item: marshall(
        {
          ...staffAccountJson,
        },
        { removeUndefinedValues: true },
      ),
    };

    const dynamoUser = await dynamoDB.putItem(params).promise();

    return dynamoUser;
  } catch (error) {
    console.error(
      `Error occurred trying to update user in db: ${updateStaffAccountAccessInput.staff_id} ${error}`,
    );
    throw error;
  }
};

export const getVerificationMethod = async (user_id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const verification_method = await dynamoDB
      .executeStatement({
        Statement: `SELECT verification_method FROM "users" WHERE "user_id" = '${user_id}'`,
      })
      .promise();

    const item = verification_method.Items?.[0]['verification_method'];

    if (!item) {
      throw new Error('verification_method not found');
    }

    return <string>item;
  } catch (error) {
    console.error(`Error occurred trying to get in db: ${user_id} ${error}`);
    throw error;
  }
};

export const getUserByVerifyCodeId = async (id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    let two_factor = await dynamoDB
      .executeStatement({
        Statement: `SELECT * FROM "two_factor" WHERE "id" = '${id}' AND 'expiring_at' > '${Math.floor(
          Date.now() / 1000,
        )}'`,
      })
      .promise();

    let item = two_factor?.Items?.[0];

    if (!item) {
      throw new Error(`unable to find two factor token for ${id}`);
    }

    const tf = unmarshaller<TwoFactor>(item);

    let user = await dynamoDB
      .executeStatement({
        Statement: `SELECT * FROM "users" WHERE "user_id" = '${tf.user_id}'`,
      })
      .promise();

    let item2 = user.Items?.[0];

    if (!item2) {
      throw new Error(`No user found for user_id ${tf.user_id}`);
    }

    const foundUser = unmarshaller<User>(item2);

    return foundUser;
  } catch (error) {
    console.error(
      `Error occurred trying to get two_factor_code in db with id: ${id} ${error}`,
    );
    throw error;
  }
};

export const updateVerifyCodeById = async (id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    let two_factor = await dynamoDB
      .executeStatement({
        Statement: `SELECT * FROM "two_factor" WHERE "id" = '${id}' AND 'expiring_at' > '${Math.floor(
          Date.now() / 1000,
        )}'`,
      })
      .promise();

    let item = two_factor?.Items?.[0];

    if (!item) {
      throw new Error(`unable to find two factor tokent for ${id}`);
    }

    const tf = unmarshaller<TwoFactor>(item);

    const sql = `UPDATE "two_factor" SET "updated_at" = '${Date.now()}' WHERE "id" = '${id}' AND "user_id" = '${
      tf.user_id
    }' AND "updated_at" IS MISSING AND "expiring_at" = ${
      tf.expiring_at
    } RETURNING ALL NEW *`;

    const result = await dynamoDB
      .executeStatement({
        Statement: sql,
      })
      .promise();

    item = result.Items?.[0];

    if (!item) {
      throw new Error('Unable to update 2 factor token');
    }

    return {
      valid: true,
      message: 'verified',
    };
  } catch (error) {
    let err = error as unknown as { code: string; message: string };

    if (err?.code && err.message.includes('The conditional request failed')) {
      return {
        valid: false,
        message: 'Token not valid',
      };
    }
    console.error(
      `Error occurred trying to get two_factor_code in db with id: ${id} ${error}`,
    );
    throw error;
  }
};
export const getVerifyCode = async (
  user_id: string,
  two_factor_code: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const two_factor = await dynamoDB
      .executeStatement({
        Statement: `SELECT * FROM "two_factor" WHERE "user_id" = '${user_id}' AND 'code' = '${parseFloat(
          two_factor_code,
        )}' AND 'expiring_at' > '${Math.floor(Date.now() / 1000)}'`,
      })
      .promise();

    const item = two_factor.Items?.[0];

    if (!item) {
      throw new Error('two_factor not found');
    } else {
      await dynamoDB
        .executeStatement({
          Statement: `DELETE * FROM "two_factor" WHERE "user_id" = '${user_id}' AND 'code' = '${parseFloat(
            two_factor_code,
          )}'`,
        })
        .promise();

      return 'verified';
    }
  } catch (error) {
    console.error(
      `Error occurred trying to get in db: ${two_factor_code} ${error}`,
    );
    throw error;
  }
};

export const deactivateBusiness = async (
  user_id: string,
  business_id: string,
  status: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    let date = new Date();
    date.setDate(date.getDate() + 7);

    const result = await dynamoDB
      .executeStatement({
        Statement: `UPDATE "businesses" SET "status" = 'deactivated','updated_at' = '${Date.now()}', 'deleting_on'= '${date}'
        WHERE  "user_id" = '${user_id}' 
          AND "business_id" = '${business_id}'
          AND "status" = '${status}'`,
      })
      .promise();

    if (result) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(`Error occurred trying to get in db: ${user_id} ${error}`);
    throw error;
  }
};

export const getPageViewPurchase = async (
  business_id: string,
  pageview_id: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();
    const result = await dynamoDB
      .executeStatement({
        Statement: `SELECT first_touch_campaign, first_touch_ad_set, first_touch_ad, last_touch_campaign, last_touch_ad_set, last_touch_ad FROM "business_purchases" 
        WHERE "business_page_view_id" = '${pageview_id}' 
              AND "business_id" = '${business_id}' LIMIT 1`,
      })
      .promise();

    const item = result?.Items?.[0];

    if (!item) {
      throw new StatusCodeError(85);
    }

    return unmarshaller<PurchaseView>(item);
  } catch (error) {
    console.error(
      `Error occurred trying to get in db: ${business_id} ${error}`,
    );
    throw error;
  }
};
export const deleteStaffAccountDynamo = async (
  staffId: string,
  managerId: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const staffAccount = await dynamoDB
      .executeStatement({
        Statement: `SELECT * FROM "users" WHERE "user_id" = '${staffId}' and "manager_id" = '${managerId}'`,
      })
      .promise();

    const item = staffAccount.Items?.[0];

    if (!item) {
      throw new Error('Staff account not found');
    }

    await dynamoDB
      .executeStatement({
        Statement: `DELETE FROM users WHERE "user_id" = '${staffId}' and "manager_id" = '${managerId}'`,
      })
      .promise();

    return unmarshaller<User>(item);
  } catch (error) {
    console.error(
      `Error occurred trying to delete user in db: ${staffId} ${error}`,
    );
    throw error;
  }
};

export const updateAutoScalingSetting = async ({
  user_id,
  auto_scale_value,
}: UpdateAutoScalingSettingInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      UPDATE "users" 
      SET "auto_scaling_setting" = '${auto_scale_value}' 
      WHERE "user_id" = '${user_id}'
    `;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    const message = `Auto scaling setting changed.`;

    return { message };
  } catch (error) {
    console.log(
      `Error occurred trying to update user with id: ${user_id} ${error}`,
    );
    throw error;
  }
};

//I know Andreas is also working a method similar,
//this is probably an opportunity to refactor this method into a 'setSocialAdAccountInfo'
//where you pass in the social type and then the field values, so that you could handle either facebook AND/OR tiktok
export const setFacebookAdAccountInfo = async ({
  business_id,
  fb_pixel_id = null,
  facebook_ad_account_id = null,
  facebook_ad_account_name = null,
  facebook_ad_account_currency = null,
  facebook_ad_account_timezone = null,
}: RemoveFacebookAdAccountInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `UPDATE businesses 
    SET fb_pixel_id = ${fb_pixel_id ? `'${fb_pixel_id}'` : null},
     facebook_ad_account_id = ${
       facebook_ad_account_id ? `'${facebook_ad_account_id}'` : null
     },
    facebook_ad_account_name = ${
      facebook_ad_account_name ? `'${facebook_ad_account_name}'` : null
    },
     facebook_ad_account_currency = ${
       facebook_ad_account_currency ? `'${facebook_ad_account_name}'` : null
     },
    facebook_ad_account_timezone = ${
      facebook_ad_account_timezone ? `'${facebook_ad_account_timezone}'` : null
    } WHERE business_id = '${business_id}' RETURNING ALL NEW *`;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    return;
  } catch (error) {
    console.log(
      `Error occurred trying to update facebook ad account info with 
      business_id=${business_id},fb_pixel_id=${fb_pixel_id},facebook_ad_account_id=${facebook_ad_account_id},facebook_ad_account_name=${facebook_ad_account_name},
      facebook_ad_account_currency=${facebook_ad_account_currency},facebook_ad_account_timezone=${facebook_ad_account_timezone}   ${error}`,
    );
    throw error;
  }
};

export const updateTimezoneCurrency = async ({
  user,
  currency,
  timezone,
}: UpdateTimezoneCurrencyInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'users',
      ConditionExpression: 'user_id=:userId',
      ExpressionAttributeValues: marshall({
        ':userId': user?.user_id,
      }),
      Item: marshall(
        {
          ...user,
          currency,
          timezone,
        },
        { removeUndefinedValues: true },
      ),
    };

    const dynamoUser = await dynamoDB.putItem(params).promise();
    const message = `Timezone and Currency selected.`;

    return { dynamoUser, message };
  } catch (error) {
    console.log(
      `Error occurred trying to update user with id: ${user?.user_id} ${error}`,
    );
    throw error;
  }
};

export const disconnectBussinesTikTokAccount = async (id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `UPDATE "businesses"
     SET  tik_tok_ad_account_id = NULL,
          tik_tok_ad_account_name = NULL, 
          tik_tok_ad_account_currency = NULL, 
          tik_tok_ad_account_timezone = NULL
      WHERE "business_id" = '${id}' RETURNING ALL NEW *`;

    const result = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = result?.Items;

    if (!item) {
      throw new StatusCodeError(1);
    }

    const business = unmarshaller<Business>(item[0]);

    logInfo(business, `Ad account disconnected`);

    return business;
  } catch (error) {
    console.error(
      `Error occurred trying to disconnect business of tik tok: ${id} ${error}`,
    );
    throw error;
  }
};

export const updateBusinessStatus = async ({
  user_id,
  business_id,
  status,
}: UpdateBusinessParams['updateBusinessStatusInput']) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      UPDATE "businesses" 
      SET "status" = '${status}' 
      WHERE "user_id" = '${user_id}' 
      AND "business_id" = '${business_id}'
    `;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    const message = `Business ${
      status === BusinessStatus.ACTIVE ? 'activated' : 'deactivated'
    }.`;

    return { message };
  } catch (error) {
    console.log(
      `Error occurred trying to update business status with id: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const countBusinessByStatus = async ({
  user_id,
  status,
}: CountBusinessByStatusInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      SELECT business_id FROM "businesses" 
      WHERE "user_id" = '${user_id}' 
      AND "status" = '${status}'
    `;

    const businessesItem = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const businesses = businessesItem?.Items;

    if (!businesses) {
      throw new Error(`No businesses was found for user ID ${user_id}`);
    }

    return { businessCount: businesses.length };
  } catch (error) {
    console.log(
      `Error occurred trying to get business with status: ${status} ${error}`,
    );
    throw error;
  }
};

export const getUserBusinessByBusinessId = async (
  business_id: string | undefined,
  user_id: string | undefined,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "user_id" = '${user_id}' AND "business_id" = '${business_id}'`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new StatusCodeError(3);
    }

    const business = unmarshaller<Business>(item);

    return business;
  } catch (error) {
    console.error(
      `Error occurred trying to lookup business: ${business_id} ${error}`,
    );
    throw error;
  }
};
export const getBusinessByVanityName = async (vanity_name: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "vanity_name" = '${vanity_name}'`;

    const businessesItem = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = businessesItem?.Items?.[0];

    const businessCheck = item;

    return { businessCheck };
  } catch (error) {
    console.log(
      `Error occurred trying to get business with vanity name: ${vanity_name} ${error}`,
    );
    throw error;
  }
};

export const getUserSessions = async (userId: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "sessions" WHERE "user_id" = '${userId}'`;

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const items = results?.Items || [];

    const userSessions = items.map((session) =>
      unmarshaller<UserSession>(session),
    );

    return userSessions;
  } catch (error) {
    console.log(
      `Error occurred trying to get sessions for user: ${userId} ${error}`,
    );
    throw error;
  }
};

export const saveNewBusiness = async (businessInput: SaveNewBusinessInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }
    const { business_id, status, user_id, business_name, vanity_name } =
      businessInput;

    const dynamoDB = new AWS.DynamoDB();

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'businesses',
      Item: marshall(
        {
          business_id,
          status,
          user_id,
          logo: null,
          business_name,
          vanity_name,
          premium_page_views: 0,
          shopify_script_tag_id: null,
          shopify_store_url: null,
          shopify_access_token: null,
          tik_tok_ad_account_id: null,
          tik_tok_ad_account_name: null,
          tik_tok_ad_account_currency: null,
          tik_tok_ad_account_timezone: null,
        },
        { removeUndefinedValues: true },
      ),
    };

    const dynamoBusiness = await dynamoDB.putItem(params).promise();

    return dynamoBusiness;
  } catch (error) {
    console.log(
      `Error occurred trying to business in db for user: ${businessInput.user_id} ${error}`,
    );
    throw error;
  }
};

export const getUserBusinessByVanityNameId = async (vanity_name: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "vanity_name" = '${vanity_name}'`;

    const businessesItem = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = businessesItem?.Items?.[0];

    if (!item) {
      throw new StatusCodeError(1);
    }

    const business = unmarshaller<Business>(item);
    return { business };
  } catch (error) {
    console.log(
      `Error occurred trying to get business with vanity name: ${vanity_name} ${error}`,
    );
    throw error;
  }
};

export const getUserBusinessByVanityName = async ({
  vanity_name,
  user_id,
}: GetBusinessByVanityName['getUserBusinessByVanityNameInput']) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "user_id" = '${user_id}' AND "vanity_name" = '${vanity_name}'`;

    const businessesItem = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = businessesItem?.Items?.[0];

    if (item) {
      const business = unmarshaller<Business>(item);

      const message = `Business fetched successfully.`;

      return { business, message };
    }

    return { business: undefined, message: '' };
  } catch (error) {
    console.log(
      `Error occurred trying to get business with vanity name: ${vanity_name} ${error}`,
    );
    throw error;
  }
};

export const setTikToktoken = async (user_id: string, access_token: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
    UPDATE "users"
    SET "tik_tok_access_token" = '${access_token}'
    WHERE "user_id" = '${user_id}'
  `;

    await dynamoDB.executeStatement({ Statement: statement }).promise();
  } catch (error) {
    console.log(
      `Error occurred trying to set tik tok token during authentication: ${error}`,
    );
    throw error;
  }
};

export const setBusinessTiktokAdAccount = async (
  user_id: string,
  business_id: string,
  tik_tok_ad_account_id: string,
  tik_tok_ad_account_name: string,
  tik_tok_ad_account_currency: string,
  tik_tok_ad_account_timezone: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      UPDATE "businesses"
      SET "tik_tok_ad_account_id" = '${tik_tok_ad_account_id}'
      SET "tik_tok_ad_account_name" = '${tik_tok_ad_account_name}'
      SET "tik_tok_ad_account_currency" = '${tik_tok_ad_account_currency}'
      SET "tik_tok_ad_account_timezone" = '${tik_tok_ad_account_timezone}'
      WHERE "user_id" = '${user_id}'
      AND "business_id" = '${business_id}'
    `;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    const business = await getBusiness(business_id);

    return business;
  } catch (error) {
    throw error;
  }
};

export const disconnectTikTok = async (user_id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
  UPDATE "users"
  SET "tik_tok_access_token" = NULL
  WHERE "user_id" = '${user_id} RETURNING ALL NEW *'
`;

    const result = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = result?.Items;

    if (!item) {
      throw new StatusCodeError(2);
    }

    const user = unmarshaller<User>(item[0]);

    return user;
  } catch (error) {
    console.log(`Error occurred trying to update user: ${error}`);
    throw error;
  }
};

export const updateUserEndTrialSource = async (
  end_trial_source: string,
  user_id: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      UPDATE "users"
      SET "end_trial_source" = '${end_trial_source}'
      WHERE "user_id" = '${user_id}'
      RETURNING ALL NEW *
    `;

    const user = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = user?.Items?.[0];

    if (!item) {
      throw new StatusCodeError(1);
    }

    const modifiedUser = unmarshaller<User>(item);
    const message = statusCodes[105].message;

    return { modifiedUser, message };
  } catch (error) {
    console.log(`Error occurred trying to update user: ${error}`);
    throw error;
  }
};

export const updateUserSubscription = async (
  userSubscriptionInput: UserSubscriptionInput,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const user = userSubscriptionInput.user;

    //Update to make use of the putItem() with the option to return updated values
    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'users',
      ConditionExpression: 'user_id=:userId',
      ExpressionAttributeValues: marshall({
        ':userId': userSubscriptionInput.user?.user_id,
      }),
      Item: marshall(
        {
          ...user,
          current_billing_period_start:
            userSubscriptionInput.current_billing_period_start,
          current_billing_period_end:
            userSubscriptionInput.current_billing_period_end,
          plan: {
            ...user.user_plan,
            business_limit: userSubscriptionInput.business_limit,
            plan_price_id: userSubscriptionInput.plan_price_id,
            plan_product_id: userSubscriptionInput.plan_product_id,
          },
          subscription: {
            ...user.subscription,
            id: userSubscriptionInput.subscription_id,
            status: userSubscriptionInput.subscription_status,
          },
        },
        { removeUndefinedValues: true },
      ),
    };

    const dynamoUser = await dynamoDB.putItem(params).promise();
    const message = statusCodes[115].message;

    return { dynamoUser, message };
  } catch (error) {
    console.log(`Error occurred trying to update user subscription: ${error}`);
    throw error;
  }
};

export const getPlanByPlanCode = async (plan_code: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const selectedPlanPromise = await dynamoDB
      .executeStatement({
        Statement: `SELECT * FROM "plans" WHERE "plan_code" = '${plan_code}'`,
      })
      .promise();

    const selectedPlan = selectedPlanPromise.Items?.[0];

    if (!selectedPlan) {
      throw new StatusCodeError(116);
    }

    const selectedPlanJson = unmarshaller<Plan>(selectedPlan);

    return { selectedPlanJson };
  } catch (error) {
    console.log(`Error occurred trying to getting plan: ${error}`);
    throw error;
  }
};

export const findExchangeRateBySourceToCurrency = async (
  account_currency: string,
  date_created?: Date,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    let dateQuery: string = '';

    if (date_created) {
      const date = getFormatDate(date_created, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      dateQuery = `AND "date_created" = '${date}'`;
    }

    const statement = `SELECT * FROM "exchange_rates" 
      WHERE "source_to_currency" = 'USD${account_currency}' ${dateQuery}
    `;

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    console.info(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new Error(`No exchange rate was found`);
    }

    const exchange = unmarshaller<ExchangeRate>(item);

    return exchange;
  } catch (error) {
    console.log(`Error occurred trying to get rate: ${error}`);
    throw error;
  }
};

/** @deprecated - Technically a dup of getBusiness */
export const checkBusiness = async (business_id: string): Promise<Business> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses" WHERE "business_id" = '${business_id}'`;

    const response = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = response?.Items?.[0];

    if (!item) {
      throw new Error(`No business was found`);
    }

    const business = unmarshaller<Business>(item);

    return business;
  } catch (error) {
    throw error;
  }
};

export const getExchangesRates = async (
  user: User,
  business: Business,
  useFacebook: boolean = false,
): Promise<{
  account_exchange_rate: number;
  base_exchange_rate: number;
  convert_currency: boolean;
  convert_two_currency: boolean;
}> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    let account_currency = user.currency;
    let convert_currency = false;
    let convert_two_currency = false;
    let account_exchange_rate: number = 0;
    let base_exchange_rate: number = 0;

    let socialAdAccountCurrency = useFacebook
      ? business.facebook_ad_account_currency
      : business.tik_tok_ad_account_currency;

    if (!(account_currency === socialAdAccountCurrency)) {
      convert_currency = true;
    }

    let statement = `SELECT * FROM "exchange_rates" WHERE "source_to_currency" = 'USD${account_currency}'`;

    if (socialAdAccountCurrency === 'USD') {
      const result = await dynamoDB
        .executeStatement({ Statement: statement })
        .promise();

      const rate = result?.Items?.[0];

      if (!rate) {
        throw new StatusCodeError(1);
      }

      account_exchange_rate = rate.rate as number;
    } else {
      statement = `SELECT * FROM "exchange_rates" WHERE "source_to_currency" = 'USD${socialAdAccountCurrency}'`;

      const result = await dynamoDB
        .executeStatement({ Statement: statement })
        .promise();

      const rate1 = result?.Items?.[0];

      if (!rate1) {
        throw new StatusCodeError(193);
      }

      base_exchange_rate = rate1.rate as number;

      let statement2 = `SELECT * FROM "exchange_rates" WHERE "source_to_currency" = 'USD${account_currency}'`;

      const result2 = await dynamoDB
        .executeStatement({ Statement: statement2 })
        .promise();

      const rate2 = result2?.Items?.[0];

      if (!rate2) {
        throw new StatusCodeError(1);
      }

      account_exchange_rate = rate2.rate as number;
      convert_two_currency = true;
    }

    return {
      account_exchange_rate,
      base_exchange_rate,
      convert_currency,
      convert_two_currency,
    };
  } catch (error) {
    throw error;
  }
};

export const getBusinessConnection = async (
  business_id: string,
): Promise<BusinessConnections> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT "facebook_ad_account_id", "facebook_ad_account_name", "shopify_store", "script_installed", 
      "tik_tok_ad_account_id", "tik_tok_ad_account_name" FROM businesses WHERE business_id = '${business_id}'`;

    const result = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const connections = result?.Items?.[0];

    if (!connections) {
      throw new StatusCodeError(1);
    }

    return unmarshaller<BusinessConnections>(connections);
  } catch (error) {
    throw error;
  }
};

export const getUserAccountIntegrationData = async (manager_id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT facebook_accessToken, facebook_userID
      FROM users WHERE "id" = ${manager_id}`;

    const result = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = result?.Items?.[0];

    if (!item) {
      throw new Error(`No user was found`);
    }

    const user = unmarshaller<User>(item);

    return user;
  } catch (error) {
    console.log(
      `Error occurred trying to get user with facebook account ${error}`,
    );
    throw error;
  }
};

export const getBusinessByUserId = async (
  userId: string,
): Promise<Business> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "businesses"
      WHERE "user_id" = '${userId}'
      ORDER BY id ASC
      LIMIT 1
    `;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new Error(`No business was found`);
    }

    const business = unmarshaller<Business>(item);

    return business;
  } catch (error) {
    console.error(`Error occurred trying to get business`);
    throw error;
  }
};

export const updateUserPageViewLimit = async (
  page_view_limit: number,
  user: User,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'users',
      ConditionExpression: 'user_id=:userId',
      ExpressionAttributeValues: marshall({
        ':userId': user?.user_id,
      }),
      Item: marshall(
        {
          ...user,
          plan: {
            ...user?.user_plan,
            page_view_limit,
          },
        },
        { removeUndefinedValues: true },
      ),
    };

    await dynamoDB.putItem(params).promise();
  } catch (error) {
    console.log(`Error occurred trying to update user: ${error}`);
    throw error;
  }
};

export const updateUser = async (data: Partial<User>, user_id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const attributesToSet = Object.entries(data)
      .map((attr) => `SET "${attr[0]}" = '${attr[1]}'`)
      .join(' ');

    const statement = `
      UPDATE "users"
        ${attributesToSet}
        WHERE "user_id" = '${user_id}'
      RETURNING ALL NEW *
    `;

    const user = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    const item = user?.Items?.[0];

    if (!item) {
      throw new StatusCodeError(1);
    }

    const modifiedUser = unmarshaller<User>(item);

    return { modifiedUser };
  } catch (error) {
    console.log(`Error occurred trying to update user: ${error}`);
    throw error;
  }
};

export const getStaffById = async (userId: string, staffId: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `SELECT * FROM "users" 
      WHERE "manager_id" = '${userId}' AND "user_id" = '${staffId}'`;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0];

    if (!item) {
      throw new Error(`No staff was found for staff ID ${staffId}`);
    }

    const staff = unmarshaller<User>(item);

    const sessions = await getUserSessions(staff.user_id);

    return { ...staff, sessions };
  } catch (error) {
    console.log(`Error occurred trying to get a staf: ${error}`);
    throw error;
  }
};

export const getAllPerformanceCampaigns = async (
  business_id: string | undefined,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      SELECT * 
      FROM "page_data_performance" 
      WHERE "business_id" = '${business_id}'       
    `;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items ?? [];
    // TODO: update the type here
    const performance = item?.map((data) => unmarshaller<any>(data));
    return performance;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};

export const getAllPerformanceData = async (
  business_id: string,
  itemType: string,
  isTypeOfSelectedArray: string | null,
  source?: string | null,
  selected_array?: string[] | undefined,
  sort?: PerformanceSortObjectType,
  filterCondition?: filterConditionType,
  numberOfPage?: number,
  dateStart?: string,
  dateEnd?: string,
): Promise<{
  performance: Performance[];
  numberPages: number;
}> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const numberOfItems = 25;

    // const dynamodb = new DynamoDBClient({ apiVersion: '2012-08-10' });
    const dynamoDB = new DynamoDB({ apiVersion: '2012-08-10' });

    let expressionAttributeValues: Record<string, any> = {};
    expressionAttributeValues[`:business_id`] = { S: `${business_id}` };
    expressionAttributeValues[`:dateEnd`] = { S: `${dateEnd}` };
    expressionAttributeValues[`:dateStart`] = { S: `${dateStart}` };

    let expressionAttributeNames: Record<string, string> = {};
    expressionAttributeNames[`#business_id`] = `business_id`;
    expressionAttributeNames[`#dateStart`] = `created`;

    let filterConditionExpression = `#dateStart BETWEEN :dateStart AND :dateEnd`;

    if (itemType) {
      filterConditionExpression += ` AND #itemType = :itemType`;
      expressionAttributeValues[`:itemType`] = { S: `${itemType}` };
      expressionAttributeNames[`#itemType`] = 'itemType';
    }

    if (source) {
      filterConditionExpression += ` AND #source = :source`;
      expressionAttributeValues[`:source`] = { S: `${source}` };
      expressionAttributeNames[`#source`] = 'source';
    }

    if (selected_array) {
      let selectedObject: any = {};
      selected_array.forEach((item: any, index: number) => {
        selectedObject[`:value${index}`] = item;
        expressionAttributeValues[`:value${index}`] = {
          S: `${item}`,
        };
      });

      if (isTypeOfSelectedArray === 'selected_campaigns') {
        filterConditionExpression += ` AND #sirge_campaign_id IN (${Object.keys(
          selectedObject,
        ).toString()})`;
        expressionAttributeNames[`#sirge_campaign_id`] = 'sirge_campaign_id';
      } else {
        filterConditionExpression += ` AND #sirge_adset_id IN (${Object.keys(
          selectedObject,
        ).toString()})`;
        expressionAttributeNames[`#sirge_adset_id`] = 'sirge_adset_id';
      }
    }

    if (filterCondition) {
      if (
        filterCondition?.filterStatus === false &&
        filterCondition?.activeChecked
      ) {
        filterConditionExpression += ` AND #source_delivery_status = :source_delivery_status`;
        expressionAttributeValues[`:source_delivery_status`] = {
          S: `${'Active'}`,
        };
        expressionAttributeNames[`#source_delivery_status`] =
          'source_delivery_status';
      } else if (filterCondition?.filterStatus === true) {
        let logicalOperator = 'AND';
        filterCondition?.Condition?.forEach((condition: any, index: number) => {
          if (condition.column !== '') {
            if (condition.operator === 'Contains') {
              filterConditionExpression += ` ${logicalOperator} contains(#val${index}, :val${index})`;

              if (typeof condition.columnValue === 'number') {
                expressionAttributeValues[`:val${index}`] = {
                  N: `${condition.columnValue}`,
                };
              } else {
                expressionAttributeValues[`:val${index}`] = {
                  S: `${condition.columnValue}`,
                };
              }
              expressionAttributeNames[`#val${index}`] = `${condition.column}`;
            }

            if (condition.operator === 'Equals') {
              filterConditionExpression += ` ${logicalOperator} #val${index} = :val${index}`;

              if (typeof condition.columnValue === 'number') {
                expressionAttributeValues[`:val${index}`] = {
                  N: `${condition.columnValue}`,
                };
              } else {
                expressionAttributeValues[`:val${index}`] = {
                  S: `${condition.columnValue}`,
                };
              }
              expressionAttributeNames[`#val${index}`] = `${condition.column}`;
            }

            if (condition.operator === 'Starts with') {
              filterConditionExpression += ` ${logicalOperator} begins_with(#val${index},:val${index})`;
              if (typeof condition.columnValue === 'number') {
                expressionAttributeValues[`:val${index}`] = {
                  N: `${condition.columnValue}`,
                };
              } else {
                expressionAttributeValues[`:val${index}`] = {
                  S: `${condition.columnValue}`,
                };
              }
              expressionAttributeNames[`#val${index}`] = `${condition.column}`;
            }

            if (condition.operator === 'Is empty') {
              filterConditionExpression += ` ${logicalOperator} attribute_not_exists(#val${index})`;
              expressionAttributeNames[`#val${index}`] = `${condition.column}`;
            }

            if (condition.operator === 'Is not empty') {
              filterConditionExpression += ` attribute_exists(#val${index})`;

              if (typeof condition.columnValue === 'number') {
                expressionAttributeValues[`:val${index}`] = { N: null };
              } else {
                expressionAttributeValues[`:val${index}`] = { S: '' };
              }
              expressionAttributeNames[`#val${index}`] = `${condition.column}`;
            }

            if (condition.operator === 'Is any of') {
              filterConditionExpression += ` ${logicalOperator} #condition.column IN (:condition.column)`;

              if (typeof condition.columnValue === 'number') {
                expressionAttributeValues[`:val${index}`] = {
                  N: `${condition.columnValue}`,
                };
              } else {
                expressionAttributeValues[`:val${index}`] = {
                  S: `${condition.columnValue}`,
                };
              }
              expressionAttributeNames[`#val${index}`] = `${condition.column}`;
            }
            logicalOperator = condition.logicalOperator;
          }
        });
      }
    }

    const params: QueryCommandInput = {
      TableName: 'page_data_performance',
      IndexName: `business_id-${
        sort?.field ? sort?.field : 'sirge_clicks'
      }-index`,
      KeyConditionExpression: `#business_id = :business_id`,
      FilterExpression: filterConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ScanIndexForward: sort?.sort,
    };

    const config: DynamoDBPaginationConfiguration = {
      client: dynamoDB,
      pageSize: numberOfItems,
    };

    const paginator = paginateQuery(config, params);
    const count = await dynamoDB.query({
      ...params,
      Select: 'COUNT',
    });

    let index = 1;
    let selectedPage: Performance[] = [];

    for await (const page of paginator) {
      if (!numberOfPage) {
        selectedPage =
          page?.Items && page?.Items?.length > 0
            ? page?.Items?.map((item) => unmarshaller<Performance>(item))
            : [];
        break;
      }

      if (index === numberOfPage && page?.Items) {
        selectedPage =
          page?.Items && page?.Items?.length > 0
            ? page?.Items?.map((item) => unmarshaller<Performance>(item))
            : [];
        break;
      }
      index++;
    }

    return {
      performance: selectedPage,
      numberPages:
        (count?.Count || 1) / numberOfItems -
          Math.floor((count?.Count || 1) / numberOfItems) >
        0
          ? Math.floor((count?.Count || 1) / numberOfItems) + 1
          : Math.floor((count?.Count || 1) / numberOfItems),
    };
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
};

export const updateBusinessShopifyStoreUrl = async (
  shopify_store_url: string,
  user_id: string,
  business_id: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      UPDATE "businesses" 
      SET "shopify_store_url" = '${shopify_store_url}' 
      WHERE "user_id" = '${user_id}' 
      AND "business_id" = '${business_id}'
    `;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    const business = await getBusiness(business_id);

    logInfo(`db is updated: ${business}`);

    return business;
  } catch (error) {
    console.log(
      `Error occurred trying to update business shopify store url with id: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const updateTiktokAdAccount = async (
  user_id: string,
  business_id: string,
  tik_tok_ad_account_id: string,
  tik_tok_ad_account_name: string,
  tik_tok_ad_account_currency: string,
  tik_tok_ad_account_timezone: string,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      UPDATE "businesses"
      SET "tik_tok_ad_account_id" = '${tik_tok_ad_account_id}'
      SET "tik_tok_ad_account_name" = '${tik_tok_ad_account_name}'
      SET "tik_tok_ad_account_currency" = '${tik_tok_ad_account_currency}'
      SET "tik_tok_ad_account_timezone" = '${tik_tok_ad_account_timezone}'
      WHERE "user_id" = '${user_id}'
      AND "business_id" = '${business_id}'
    `;

    await dynamoDB.executeStatement({ Statement: statement }).promise();

    const business = await getBusiness(business_id);

    logInfo(`db is updated: ${business}`);
  } catch (error) {
    console.log(
      `Error occurred trying to update business shopify store url with id: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const getBusinessAnalytics = async (business_id: string) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
      SELECT * 
      FROM "analytics" 
      WHERE "business_id" = '${business_id}'
    `;

    logInfo(`SQL statement to execute: ${statement}`);

    const results = await dynamoDB
      .executeStatement({ Statement: statement })
      .promise();

    logInfo(`result returned from db: ${JSON.stringify(results)}`);

    const item = results?.Items?.[0] ?? {};

    const analytics = unmarshaller<Analytics>(item);
    return analytics;
  } catch (error) {
    console.log(`Error occurred trying to get all analytics: ${error}`);
    throw error;
  }
};

export const updateBusinessAnalytics = async (
  bestPerforming: OrderResult,
  analytics: Analytics,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const params: AWS.DynamoDB.PutItemInput = {
      TableName: 'analytics',
      Item: marshall(
        {
          ...analytics,
          performing_product: {
            ...analytics?.performing_product,
            bestPerforming,
          },
        },
        { removeUndefinedValues: true },
      ),
    };

    await dynamoDB.putItem(params).promise();
  } catch (error) {
    console.log(`Error occurred trying to update analytics: ${error}`);
    throw error;
  }
};
export const getVisitorsOfBusiness = async (
  businessId: string,
  page: number,
  sort?: SortObjectType,
): Promise<any> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    let params: AWS.DynamoDB.QueryInput = {
      TableName: 'page_data_visitors',
      KeyConditionExpression: 'business_id = :businessId AND page = :page',
      ExpressionAttributeValues: {
        ':businessId': {
          S: businessId,
        },
        ':page': {
          S: page.toString(),
        },
      },
    };

    if (sort) {
      params.IndexName = `business_id-${sort.field}-index`;
      if (sort.sort === 'desc') {
        params.ScanIndexForward = false;
      }
    }

    const results = await dynamoDB.query(params).promise();

    const items = results?.Items;

    if (!items) {
      return false;
    }

    const visitors = items.map((item) => unmarshaller<VisitorDetail>(item));

    const totalCount = visitors[0]?.total_records ?? 0;

    return { visitors, totalCount };
  } catch (error) {
    console.error(
      `Error occurred trying to lookup business: ${businessId} ${error}`,
    );
    throw error;
  }
};

export const getVisitorsOfBusinessGraph = async (
  businessId: string,
): Promise<any> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    let params: AWS.DynamoDB.QueryInput = {
      TableName: 'page_data_visitors_chart',
      KeyConditionExpression: 'business_id = :businessId',
      ExpressionAttributeValues: {
        ':businessId': {
          S: businessId,
        },
      },
    };

    const results = await dynamoDB.query(params).promise();

    const items = results?.Items;

    if (!items) {
      return false;
    }

    const visitors = items.map((item) => unmarshaller<VisitorDetail>(item));

    const lastEvaluatedKeyOffset =
      results.LastEvaluatedKey &&
      Buffer.from(JSON.stringify(results.LastEvaluatedKey)).toString('base64');

    const pagination = {
      nextOffset: lastEvaluatedKeyOffset,
      hasNextPage: !!lastEvaluatedKeyOffset,
    };

    const totalCount = visitors[0]?.total_records ?? 0;

    return { visitors, pagination, totalCount };
  } catch (error) {
    console.error(
      `Error occurred trying to lookup business: ${businessId} ${error}`,
    );
    throw error;
  }
};
export const updateMontlyBudget = async (data: UpdateMonthlyBudgetInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const dynamoDB = new AWS.DynamoDB();

    const statement = `
    UPDATE "analytics"
    SET monthly_budget.total='${data.amount}'
    WHERE analytic_id = '${data.analytic_id}'
  `;

    logInfo(`SQL statement to execute: ${statement}`);

    await dynamoDB.executeStatement({ Statement: statement }).promise();
  } catch (error) {
    console.log(`Error occurred trying to update monthly budget: ${error}`);
    throw error;
  }
};

export const getBusinessSourcesById = async (
  business_id: string,
  startDate?: string,
  endDate?: string,
  sort?: SourcesSortObjectType,
  numberOfPage?: number,
): Promise<{
  sources: PageView[];
  numberPages: number;
}> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const numberOfItems = 25;

    const dynamoDB = new DynamoDB({ apiVersion: '2012-08-10' });

    const typesKeyConditionExpression: Record<FieldSourcesSortType, string> = {
      source: '#source BETWEEN :startLetter AND :endLetter',
      clicks_count: '#clicks_count >= :defaultClickCount',
      purchases_count: '#purchases_count >= :defaultPurchasesCount',
      created: '#created BETWEEN :startDate AND :endDate',
    };

    const typesExpressionAttributeValues: Record<
      FieldSourcesSortType,
      Record<string, object>
    > = {
      source: {
        ':startLetter': { S: `A` },
        ':endLetter': { S: `Z` },
      },
      clicks_count: {
        ':defaultClickCount': {
          S: '0',
        },
      },
      purchases_count: {
        ':defaultPurchasesCount': {
          S: '0',
        },
      },
      created: {
        ':startDate': { S: `${startDate}` },
        ':endDate': { S: `${endDate}` },
      },
    };

    const params: QueryCommandInput = {
      TableName: 'page_data_sources',
      IndexName: `business_id-${sort?.field ? sort?.field : 'created'}-index`,
      KeyConditionExpression: `#business_id = :business_id ${
        sort?.field && `AND ${typesKeyConditionExpression[sort.field]}`
      }`,
      ExpressionAttributeNames: {
        '#business_id': 'business_id',
        ...(sort?.field && { [`#${sort?.field}`]: sort?.field }),
      },
      ExpressionAttributeValues: {
        ':business_id': { S: `${business_id}` },
        ...(sort?.field && { ...typesExpressionAttributeValues[sort.field] }),
      },
      ScanIndexForward: sort?.sort === 'desc' ? false : true,
    };

    const config: DynamoDBPaginationConfiguration = {
      client: dynamoDB,
      pageSize: numberOfItems,
    };

    const paginator = paginateQuery(config, params);

    const count = await dynamoDB.query({
      ...params,
      Select: 'COUNT',
    });

    let sources: PageView[] = [];

    let index = 1;

    for await (const page of paginator) {
      if (index === numberOfPage && page?.Items) {
        const items = page?.Items as unknown[];
        sources = items as PageView[];
        break;
      }

      index++;
    }

    return {
      sources,
      numberPages: Math.floor((count?.Count || 1) / numberOfItems),
    };
  } catch (error) {
    console.log(
      `Error occurred trying to get the source information of the business: ${business_id} ${error}`,
    );
    throw error;
  }
};

// export const getVisitorsOfBusiness = async (
//   businessId: string,
//   numberOfPage?: number,
//   sort?: SortObjectType,
//   lastEvaluatedKey?: string,
// ): Promise<{ all_visitors: VisitorsAggregate[]; total_records: number }> => {
//   try {
//     if (!Object.entries(keys).length) {
//       await setConfig();
//     }

//     const numberOfItems = 25;

//     const dynamodb = new DynamoDBClient({ apiVersion: '2012-08-10' });

//     let sortColumn = sort?.field ? sort.field : 'visitor_name';

//     const expressionAttributeValues: { [key: string]: any } = {
//       ':business_id': { S: businessId },
//     };

//     const expressionAttributesNames: { [key: string]: string } = {
//       '#business_id': 'business_id',
//     };

//     let keyConditionExpression = '#business_id = :business_id';
//     if (sortColumn === 'visitor_name') {
//       expressionAttributesNames['#visitor_name'] = 'visitor_name';
//       expressionAttributeValues[':startLetter'] = { S: 'A' };
//       expressionAttributeValues[':endLetter'] = { S: 'Z' };
//       keyConditionExpression +=
//         ' AND #visitor_name BETWEEN :startLetter AND :endLetter';
//     } else if (sortColumn) {
//       const sortField = `#${sortColumn}`;
//       expressionAttributesNames[sortField] = sortColumn;
//       expressionAttributeValues[`:${sortColumn}`] = { N: '0' };
//       keyConditionExpression += ` AND ${sortField} > :${sortColumn}`;
//     }

//     const params: QueryCommandInput = {
//       TableName: 'page_data_visitor',
//       IndexName: `business_id-${sortColumn}-index`,
//       KeyConditionExpression: keyConditionExpression,
//       ExpressionAttributeNames: expressionAttributesNames,
//       ExpressionAttributeValues: expressionAttributeValues,
//       ...(sort?.sort === 'asc'
//         ? { ScanIndexForward: true }
//         : { ScanIndexForward: false }),
//     };

//     const config = {
//       client: dynamodb,
//       pageSize: numberOfItems,
//       startingToken: lastEvaluatedKey,
//     };

//     const paginator = paginateQuery(config, params);

//     let currentPage = 0;
//     let selectedPage = [];
//     let allVisitors = [];
//     for await (const page of paginator) {
//       if (!page?.Items) {
//         continue;
//       }

//       console.log(`Records returned: ${page.Items.length}`);
//       console.log(`Pages for pager: ${page.Items.length / numberOfItems}`);
//       currentPage++;
//       for (const item of page.Items) {
//         if (currentPage === numberOfPage) {
//           selectedPage.push(item);
//         }
//         allVisitors.push(item);
//       }

//       page.Items.forEach((item) => {
//         console.log(item);
//       });
//     }

//     console.log({ selectedPage });

//     return { all_visitors: allVisitors, total_records: allVisitors.length };
//   } catch (error) {
//     console.error(
//       `Error occurred trying to lookup business: ${businessId} ${error}`,
//     );
//     throw error;
//   }
// };

export const updateRoasGoals = async (data: UpdateRoasGoalsInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    type UpdateRoasGoalsKeys = 'campaigns' | 'ads' | 'adsets';

    const dynamoDB = new AWS.DynamoDB();

    const dataKeys = Object.keys(data).filter(
      (key) => key !== 'analytic_id',
    ) as UpdateRoasGoalsKeys[];

    const statement = `
    UPDATE "analytics"
    SET 
    ${
      data[dataKeys[0]]
        ? `roas_goals.${dataKeys[0]}.goal=${data[dataKeys[0]]}`
        : ''
    }
    ${
      data[dataKeys[1]]
        ? `, roas_goals.${dataKeys[1]}.goal=${data[dataKeys[1]]}`
        : ''
    }
    ${
      data[dataKeys[2]]
        ? `, roas_goals.${dataKeys[2]}.goal=${data[dataKeys[2]]}`
        : ''
    }    
    WHERE analytic_id = '${data.analytic_id}'
  `;

    logInfo(`SQL statement to execute: ${statement}`);

    await dynamoDB.executeStatement({ Statement: statement }).promise();
  } catch (error) {
    console.log(`Error occurred trying to update monthly budget: ${error}`);
    throw error;
  }
};
