import AWS from 'aws-sdk';
import * as Sentry from '@sentry/serverless';
import { Db, MongoClient, ObjectId } from 'mongodb';
import {
  UserInput,
  StaffAccountInput,
  UpdateTimezoneCurrencyInput,
  UpdateAutoScalingSettingInput,
  UpdateBusinessParams,
  CountBusinessByStatusInput,
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
  PerformanceSortObjectType,
  filterConditionType,
  SourcesSortObjectType,
  UpdateMonthlyBudgetInput,
  UpdateRoasGoalsInput,
  PerformanceSummary,
  FieldPerformanceSortType,
  GetBusinessByVanityName,
} from './types';
// import { SortObjectType } from '../lambda-handlers/get-all-visitors';
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
  AllBusinessVisitor,
  FilterObjectType,
  GetAllVisitorResponse,
  SortObjectType,
} from '../lambda-handlers/get-all-visitors-mongo';
import { PageView } from '@sirge-io/sirge-utils';
import { JsonFileLogDriver } from 'aws-cdk-lib/aws-ecs';

require('dotenv').config();

const keys: AccessKeys = {};

const MONGO_URI = process.env.MONGO_DB_CONNSTRING;

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

let cachedDb: Db | null = null;

async function connectToDatabase() {
  if (!MONGO_URI) {
    console.log(MONGO_URI);
    throw new Error(
      'Unable to connect to MongoDb no connection string was provided',
    );
  }

  if (cachedDb) {
    return cachedDb;
  }

  // Connect to our MongoDB database hosted on MongoDB Atlas
  const client = new MongoClient(MONGO_URI);

  // Specify which database we want to use
  const db = await client.db(process.env.MONGO_DB_NAME);

  cachedDb = db;
  return db;
}

export const getBusiness = async (business_id: string) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const business = await collection.findOne<Business>({ business_id });

    if (!business) {
      throw new StatusCodeError(3);
    }

    return business;
  } catch (error) {
    console.error(`Error occurred trying to lookup business: ${business_id} ${error}`);
    throw error;
  }
};

export const getBusinessEventLogByBusinessIds = async (
  businessIds: string[],
): Promise<EventLog[]> => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('event_log');

    const eventLogs = await collection
      .find<EventLog>({ business_id: { $in: businessIds } })
      .toArray();

    return eventLogs;
  } catch (error) {
    console.error(
      `Error occurred trying to lookup business event logs: ${businessIds} ${error}`,
    );
    throw error;
  }
};

export const getActiveBusinessesByBusinessId = async (businessId: string) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const businesses = await collection
      .find<Business[]>({ business_id: businessId, status: 'active' })
      .toArray();

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
    const conn = await connectToDatabase();
    const collection = conn.collection('event_log');

    const eventLogs = await collection
      .find<EventLog>({
        business_id: { $in: businessIds },
        created: { $gte: startDate / 1000, $lte: endDate / 1000 },
      })
      .toArray();

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
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const stripe_customer_id =
      user.subscription.customer_id ?? user.stripe_customer_id;

    if (input.payment_method) {
      await updateCard(stripe_customer_id, input.payment_method);
    }

    await collection.updateOne(
      { user_id: user.user_id },
      {
        $set: {
          card_last_four_digits: input.card_last_four_digits,
          card_expiry_date: input.card_expiry_date,
          card_type: input.card_type,
        },
      },
    );
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
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const business = await collection.findOne({
      business_id: input.business_id,
      user_id: user.user_id,
      status: 'active',
    });

    if (!business) {
      throw new StatusCodeError(1);
    }

    await collection.updateOne(
      { business_id: business.business_id },
      {
        $set: {
          fb_pixel_id: input.fb_pixel_id,
        },
      },
    );
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
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const business = await collection.findOne<Business>({
      user_id: user_id,
      business_id: business_id,
      status: status,
    });

    if (!business) {
      throw new StatusCodeError(3);
    }

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
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const result = await collection.findOneAndUpdate(
      { business_id },
      { $set: { business_name: business_name } },
      { returnDocument: 'after' },
    );

    return result.value as unknown as Business;
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
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const result = await collection.findOneAndUpdate(
      { business_id },
      { $set: { logo: file_url } },
      { returnDocument: 'after' },
    );

    return result.value as unknown as Business;
  } catch (error) {
    console.log(
      `Error occurred trying to update business with id: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const getUserByEmail = async (email: string): Promise<User> => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const user = await collection.findOne<User>({ email: email });

    if (!user) {
      throw new Error(`No user was found for email ${email}`);
    }

    return user;
  } catch (error) {
    console.error(`Error occurred trying to lookup user: ${email} ${error}`);
    throw error;
  }
};

export const getBusinessesByUserId = async (
  userId: string,
): Promise<Business[]> => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const businesses = await collection
      .find<Business>({ user_id: userId })
      .toArray();

    return businesses;
  } catch (error) {
    console.error(`Error occurred trying to lookup user: ${userId} - ${error}`);
    throw error;
  }
};

export const getUserById = async (userId: string): Promise<User> => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const user = await collection.findOne<User>({ user_id: userId });

    if (!user) {
      throw new Error(`No user was found for user ID ${userId}`);
    }

    return user;
  } catch (error) {
    console.error(`Error occurred trying to lookup user: ${userId} - ${error}`);
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
    const conn = await connectToDatabase();

    const usersCollection = conn.collection('users');

    const isManager = auth?.groups?.includes('Managers');
    const isStaff = auth?.groups?.includes('Staff');

    let managingUser: User | undefined;

    const userId = auth.sub;

    const userResult = await usersCollection.findOne<User>({ user_id: userId });

    if (!userResult) {
      throw new Error(`No user was found for sub:${userId}`);
    }

    const authenticatedUser = userResult;

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

      const userResult = await usersCollection.findOne<User>({
        user_id: managerUserId,
      });

      if (!userResult) {
        throw new Error(`No user was found for sub:${managerUserId}`);
      }

      managingUser = userResult;

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

export const getPlanByPlanCode = async (plan_code: string) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('plans');

    const selectedPlan = await collection.findOne<Plan>({
      plan_code: plan_code,
    });

    if (!selectedPlan) {
      throw new StatusCodeError(116);
    }

    return { selectedPlanJson: selectedPlan };
  } catch (error) {
    console.log(`Error occurred trying to getting plan: ${error}`);
    throw error;
  }
};

export const saveUser = async (
  registerUserInput: UserInput,
  cognitoUser: AWS.CognitoIdentityServiceProvider.SignUpResponse,
) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const conn = await connectToDatabase();
    const usersCollection = conn.collection('users');

    const checkUserExists = await usersCollection.findOne({
      email: registerUserInput.email,
    });

    if (checkUserExists) {
      throw new Error('User already exists');
    }

    const newUserId = cognitoUser.UserSub;

    const newUser = {
      user_id: newUserId,
      first_name: registerUserInput.first_name,
      last_name: registerUserInput.last_name,
      email: registerUserInput.email,
      shopify_store_url: registerUserInput.shopify_store_url,
    };

    const mongoUser = await usersCollection.insertOne(newUser);

    return mongoUser;
  } catch (error) {
    console.error(
      `Error occurred trying to register user in db: ${registerUserInput.email} ${error}`,
    );
    throw error;
  }
};

export const getAllStaffAccounts = async (
  managerId: string,
): Promise<User[]> => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const staffAccounts = await collection
      .find<User>({ manager_id: managerId })
      .toArray();

    if (!staffAccounts.length) {
      throw new Error(`No user was found for manager ID ${managerId}`);
    }

    return staffAccounts;
  } catch (error) {
    console.error(
      `Error occurred trying to lookup user: ${managerId} - ${error}`,
    );
    throw error;
  }
};

export const createTwoFactor = async (user_id: string, email: string) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('two_factor');

    const pinCode = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 10),
    ).join('');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const twoFactor: TwoFactor = {
      user_id: user_id,
      expiring_at: expiresAt.getTime(),
      code: pinCode.toString(),
      id: crypto.randomUUID(),
    };

    const result = await collection.insertOne({
      ...twoFactor,
      created_at: new Date().getTime(),
    });

    if (!result.acknowledged) {
      throw new Error(`Failed to create two_factor record for user: ${email}`);
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
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const newUser = {
      first_name: registerUserInput.first_name,
      last_name: registerUserInput.last_name,
      user_id: cognitoUser.UserSub,
      manager_id: managerId,
    };

    const result = await collection.insertOne(newUser);

    if (!result.acknowledged) {
      throw new Error('Error registering staff user in db');
    }

    return newUser;
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
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const filter = { user_id: user.user_id };
    const update = {
      $set: {
        facebook_userID,
        facebook_accessToken,
      },
    };

    const result = await collection.updateOne(filter, update);

    if (!result.acknowledged) {
      throw new Error('Error updating user facebook access');
    }

    return result;
  } catch (error) {
    console.log(
      `Error occurred trying to update user facebook access: ${user.user_id} ${error}`,
    );
    throw error;
  }
};

export const getPlatformSettings = async () => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('platform_settings');

    const item = await collection.findOne<PlatformSettings>({});

    if (!item) {
      throw new StatusCodeError(75);
    }

    const platformSettings = item;
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
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const filter = { user_id: user_id };
    const update = {
      $set: {
        profile_photo: file_url,
      },
    };

    const userUpdated = await collection.findOneAndUpdate(filter, update, {
      returnDocument: 'after',
    });

    return userUpdated.value as unknown as User;
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
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const staffAccount = await collection.findOne<User>({
      user_id: updateStaffAccountAccessInput.staff_id,
      manager_id: managerId,
    });

    if (!staffAccount) {
      throw new Error('Staff account not found');
    }

    const hasAccess = staffAccount.business_access?.find(
      (item) => item.vanity_name === updateStaffAccountAccessInput.vanity_name,
    );

    if (hasAccess) {
      const updatedAccess =
        staffAccount.business_access?.filter(
          (item) =>
            item.vanity_name !== updateStaffAccountAccessInput.vanity_name,
        ) ?? [];

      staffAccount.business_access = updatedAccess;
    } else {
      const accessItem = {
        vanity_name: updateStaffAccountAccessInput.vanity_name,
      };

      const updatedAccess: BusinessAccess[] = staffAccount.business_access
        ? [...staffAccount.business_access, accessItem]
        : [accessItem];

      staffAccount.business_access = updatedAccess;
    }

    const filter = { user_id: updateStaffAccountAccessInput.staff_id };
    const update = { $set: staffAccount };

    const result = await collection.updateOne(filter, update);

    return result;
  } catch (error) {
    console.error(
      `Error occurred trying to update user in db: ${updateStaffAccountAccessInput.staff_id} ${error}`,
    );
    throw error;
  }
};

export const getVerificationMethod = async (user_id: string) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const user = await collection.findOne<User>({ user_id });

    if (!user || !user.verification_method) {
      throw new Error('verification_method not found');
    }

    return user.verification_method;
  } catch (error) {
    console.error(`Error occurred trying to get in db: ${user_id} ${error}`);
    throw error;
  }
};

export const getUserByVerifyCodeId = async (id: string) => {
  try {
    const conn = await connectToDatabase();
    const twoFactorCollection = conn.collection('two_factor');
    const userCollection = conn.collection('users');

    const twoFactor = await twoFactorCollection.findOne({
      id,
      expiring_at: { $gt: Math.floor(Date.now() / 1000) },
    });

    if (!twoFactor) {
      throw new Error(`unable to find two factor token for ${id}`);
    }

    const user = await userCollection.findOne<User>({
      user_id: twoFactor.user_id,
    });

    if (!user) {
      throw new Error(`No user found for user_id ${twoFactor.user_id}`);
    }

    return user;
  } catch (error) {
    console.error(
      `Error occurred trying to get two_factor_code in db with id: ${id} ${error}`,
    );
    throw error;
  }
};

export const updateVerifyCodeById = async (id: string) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('two_factor');

    const twoFactor = await collection.findOne({
      id,
      expiring_at: { $gt: Math.floor(Date.now() / 1000) },
    });

    if (!twoFactor) {
      throw new Error(`unable to find two factor token for ${id}`);
    }

    const filter = {
      id,
      user_id: twoFactor.user_id,
      expiring_at: twoFactor.expiring_at,
    };
    const update = { $set: { updated_at: Date.now() } };

    const result = await collection.updateOne(filter, update);

    if (result.modifiedCount === 0) {
      throw new Error('Unable to update 2 factor token');
    }

    return {
      valid: true,
      message: 'verified',
    };
  } catch (error) {
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
    const conn = await connectToDatabase();
    const collection = conn.collection('two_factor');

    const twoFactor = await collection.findOne({
      user_id,
      code: parseFloat(two_factor_code),
      expiring_at: { $gt: Math.floor(Date.now() / 1000) },
    });

    if (!twoFactor) {
      throw new Error('two_factor not found');
    } else {
      await collection.deleteOne({
        user_id,
        code: parseFloat(two_factor_code),
      });

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
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    let date = new Date();
    date.setDate(date.getDate() + 7);

    const filter = {
      user_id,
      business_id,
      status,
    };
    const update = {
      $set: {
        status: 'deactivated',
        updated_at: Date.now(),
        deleting_on: date,
      },
    };

    const result = await collection.updateOne(filter, update);

    return result.modifiedCount > 0;
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
    const conn = await connectToDatabase();
    const collection = conn.collection('business_purchases');

    const result = await collection.findOne<PurchaseView>(
      {
        business_page_view_id: pageview_id,
        business_id,
      },
      {
        projection: {
          first_touch_campaign: 1,
          first_touch_ad_set: 1,
          first_touch_ad: 1,
          last_touch_campaign: 1,
          last_touch_ad_set: 1,
          last_touch_ad: 1,
        },
      },
    );

    if (!result) {
      throw new StatusCodeError(85);
    }

    return result;
  } catch (error) {
    console.error(
      `Error occurred trying to get in db: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const deleteStaffAccount = async (
  staffId: string,
  managerId: string,
) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const staffAccount = await collection.findOne<User>({
      user_id: staffId,
      manager_id: managerId,
    });

    if (!staffAccount) {
      throw new Error('Staff account not found');
    }

    await collection.deleteOne({
      user_id: staffId,
      manager_id: managerId,
    });

    return staffAccount;
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
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const filter = { user_id };
    const update = { $set: { auto_scaling_setting: auto_scale_value } };

    await collection.updateOne(filter, update);

    const message = `Auto scaling setting changed.`;

    return { message };
  } catch (error) {
    console.log(
      `Error occurred trying to update user with id: ${user_id} ${error}`,
    );
    throw error;
  }
};

export const setFacebookAdAccountInfo = async ({
  business_id,
  fb_pixel_id = null,
  facebook_ad_account_id = null,
  facebook_ad_account_name = null,
  facebook_ad_account_currency = null,
  facebook_ad_account_timezone = null,
}: RemoveFacebookAdAccountInput) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const filter = { business_id };
    const update = {
      $set: {
        fb_pixel_id,
        facebook_ad_account_id,
        facebook_ad_account_name,
        facebook_ad_account_currency,
        facebook_ad_account_timezone,
      },
    };

    await collection.updateOne(filter, update);

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
    const conn = await connectToDatabase();
    const collection = conn.collection('users');

    const filter = { user_id: user?.user_id };
    const update = {
      $set: {
        currency,
        timezone,
      },
    };

    await collection.updateOne(filter, update);
  } catch (error) {
    console.log(
      `Error occurred trying to update user with id: ${user?.user_id} ${error}`,
    );
    throw error;
  }
};

export const disconnectBussinesTikTokAccount = async (id: string) => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('businesses');

    const filter = { business_id: id };
    const update = {
      $set: {
        tik_tok_ad_account_id: null,
        tik_tok_ad_account_name: null,
        tik_tok_ad_account_currency: null,
        tik_tok_ad_account_timezone: null,
      },
    };

    const { value } = await collection.findOneAndUpdate(filter, update);

    if (!value) {
      throw new StatusCodeError(1);
    }

    logInfo(value, `Ad account disconnected`);

    return value as unknown as Business | null; // this needs to be tested to make sure we get the correct result
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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const result = await businessesCollection.updateOne(
      { user_id, business_id },
      { $set: { status } },
    );

    if (result.modifiedCount === 0) {
      throw new Error('No business was updated.');
    }

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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const businessCount = await businessesCollection.countDocuments({
      user_id,
      status,
    });

    if (businessCount === 0) {
      throw new Error(`No businesses were found for user ID ${user_id}`);
    }

    return { businessCount };
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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const business = await businessesCollection.findOne<Business>({
      user_id,
      business_id,
    });

    if (!business) {
      throw new StatusCodeError(3);
    }

    return business;
  } catch (error) {
    console.error(
      `Error occurred trying to lookup business: ${business_id} ${error}`,
    );
    throw error;
  }
};

export const getBusinessByVanityName = async (
  vanity_name: string,
): Promise<Business | null> => {
  try {
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const business = await businessesCollection.findOne<Business>({
      vanity_name,
    });

    return business;
  } catch (error) {
    console.log(
      `Error occurred trying to get business with vanity name: ${vanity_name} ${error}`,
    );
    throw error;
  }
};

export const getUserSessions = async (userId: string) => {
  try {
    const conn = await connectToDatabase();
    const sessionsCollection = conn.collection('sessions');

    const userSessions = await sessionsCollection
      .find<UserSession>({ user_id: userId })
      .toArray();

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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const { business_id, status, user_id, business_name, vanity_name } =
      businessInput;

    const newBusiness = {
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
    };

    await businessesCollection.insertOne(newBusiness);

    return newBusiness;
  } catch (error) {
    console.log(
      `Error occurred trying to business in db for user: ${businessInput.user_id} ${error}`,
    );
    throw error;
  }
};

export const getUserBusinessByVanityNameId = async (vanity_name: string) => {
  try {
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const business = await businessesCollection.findOne<Business>({
      vanity_name,
    });

    if (!business) {
      throw new StatusCodeError(1);
    }

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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const business = await businessesCollection.findOne<Business>({
      user_id,
      vanity_name,
    });

    if (!business) {
      throw new StatusCodeError(1);
    }

    const message = `Business fetched successfully.`;

    return { business, message };
  } catch (error) {
    console.log(
      `Error occurred trying to get business with vanity name: ${vanity_name} ${error}`,
    );
    throw error;
  }
};

export const setTikToktoken = async (user_id: string, access_token: string) => {
  try {
    const conn = await connectToDatabase();
    const usersCollection = conn.collection('users');

    await usersCollection.updateOne(
      { user_id },
      { $set: { tik_tok_access_token: access_token } },
    );
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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    await businessesCollection.updateOne(
      { user_id, business_id },
      {
        $set: {
          tik_tok_ad_account_id,
          tik_tok_ad_account_name,
          tik_tok_ad_account_currency,
          tik_tok_ad_account_timezone,
        },
      },
    );

    const business = await businessesCollection.findOne<Business>({
      business_id,
    });

    return business;
  } catch (error) {
    throw error;
  }
};

export const disconnectTikTok = async (user_id: string) => {
  try {
    const conn = await connectToDatabase();
    const usersCollection = conn.collection<User>('users');

    const result = await usersCollection.findOneAndUpdate(
      { user_id },
      { $set: { tik_tok_access_token: null } },
      { returnDocument: 'after' },
    );

    const user = result.value as User;

    if (!user) {
      throw new StatusCodeError(2);
    }

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
    const conn = await connectToDatabase();
    const usersCollection = conn.collection('users');

    const result = await usersCollection.findOneAndUpdate(
      { user_id },
      { $set: { end_trial_source } },
      { returnDocument: 'after' },
    );

    const modifiedUser = result.value as unknown as User; // this needs to be tested make sure didnt break anything

    if (!modifiedUser) {
      throw new StatusCodeError(1);
    }

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
    const conn = await connectToDatabase();
    const usersCollection = conn.collection('users');

    const user = userSubscriptionInput.user;

    const result = await usersCollection.findOneAndUpdate(
      { user_id: user?.user_id },
      {
        $set: {
          current_billing_period_start:
            userSubscriptionInput.current_billing_period_start,
          current_billing_period_end:
            userSubscriptionInput.current_billing_period_end,
          'plan.business_limit': userSubscriptionInput.business_limit,
          'plan.plan_price_id': userSubscriptionInput.plan_price_id,
          'plan.plan_product_id': userSubscriptionInput.plan_product_id,
          'subscription.id': userSubscriptionInput.subscription_id,
          'subscription.status': userSubscriptionInput.subscription_status,
        },
      },
      { returnDocument: 'after' },
    );

    const updatedUser = result.value;
    const message = statusCodes[115].message;

    return { updatedUser, message };
  } catch (error) {
    console.log(`Error occurred trying to update user subscription: ${error}`);
    throw error;
  }
};

export const findExchangeRateBySourceToCurrency = async (
  account_currency: string,
  date_created?: Date,
) => {
  try {
    const conn = await connectToDatabase();
    const exchangeRatesCollection = conn.collection('exchange_rates');

    let query: any = {
      source_to_currency: `USD${account_currency}`,
    };

    if (date_created) {
      query['date_created'] = date_created;
    }

    const exchange = await exchangeRatesCollection.findOne<ExchangeRate>(query);

    if (!exchange) {
      throw new Error(`No exchange rate was found`);
    }

    return exchange;
  } catch (error) {
    console.log(`Error occurred trying to get rate: ${error}`);
    throw error;
  }
};

export const checkBusiness = async (business_id: string): Promise<Business> => {
  try {
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const business = await businessesCollection.findOne<Business>({
      business_id,
    });

    if (!business) {
      throw new Error(`No business was found`);
    }

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
    const conn = await connectToDatabase();
    const exchangeRatesCollection = conn.collection('exchange_rates');

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

    const query1 = {
      source_to_currency: `USD${account_currency}`,
    };

    const query2 = {
      source_to_currency: `USD${socialAdAccountCurrency}`,
    };

    if (socialAdAccountCurrency === 'USD') {
      const rate = await exchangeRatesCollection.findOne(query1);

      if (!rate) {
        throw new StatusCodeError(1);
      }

      account_exchange_rate = rate.rate as number;
    } else {
      const rate1 = await exchangeRatesCollection.findOne(query2);

      if (!rate1) {
        throw new StatusCodeError(193);
      }

      base_exchange_rate = rate1.rate as number;

      const rate2 = await exchangeRatesCollection.findOne(query1);

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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const business = await businessesCollection.findOne<BusinessConnections>(
      { business_id },
      {
        projection: {
          facebook_ad_account_id: 1,
          facebook_ad_account_name: 1,
          shopify_store: 1,
          script_installed: 1,
          tik_tok_ad_account_id: 1,
          tik_tok_ad_account_name: 1,
        },
      },
    );

    if (!business) {
      throw new StatusCodeError(1);
    }

    return business;
  } catch (error) {
    throw error;
  }
};

export const getUserAccountIntegrationData = async (manager_id: string) => {
  try {
    const conn = await connectToDatabase();
    const usersCollection = conn.collection('users');

    const user = await usersCollection.findOne<User>(
      { id: manager_id },
      {
        projection: {
          facebook_accessToken: 1,
          facebook_userID: 1,
        },
      },
    );

    if (!user) {
      throw new Error(`No user was found`);
    }

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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    const business = await businessesCollection.findOne<Business>(
      { user_id: userId },
      { sort: { id: 1 } },
    );

    if (!business) {
      throw new Error(`No business was found`);
    }

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
    const conn = await connectToDatabase();
    const usersCollection = conn.collection('users');

    const updatedUser = {
      ...user,
      plan: {
        ...user?.user_plan,
        page_view_limit,
      },
    };

    await usersCollection.updateOne(
      { user_id: user?.user_id },
      { $set: updatedUser },
    );
  } catch (error) {
    console.log(`Error occurred trying to update user: ${error}`);
    throw error;
  }
};

export const updateUser = async (data: Partial<User>, user_id: string) => {
  try {
    const conn = await connectToDatabase();
    const usersCollection = conn.collection('users');

    const result = await usersCollection.findOneAndUpdate(
      { user_id },
      { $set: data },
      { returnDocument: 'after' },
    );

    if (!result.value) {
      throw new StatusCodeError(1);
    }

    return { modifiedUser: result.value as unknown as User }; // test this, make sure I didnt break anything
  } catch (error) {
    console.log(`Error occurred trying to update user: ${error}`);
    throw error;
  }
};

export const getStaffById = async (userId: string, staffId: string) => {
  try {
    const conn = await connectToDatabase();
    const usersCollection = conn.collection('users');

    const staff = await usersCollection.findOne<User>({
      manager_id: userId,
      user_id: staffId,
    });

    if (!staff) {
      throw new Error(`No staff was found for staff ID ${staffId}`);
    }

    const sessions = await getUserSessions(staff.user_id);

    logInfo(`result returned from db: ${JSON.stringify(sessions)}`);

    return { ...staff, sessions };
  } catch (error) {
    console.log(`Error occurred trying to get a staff: ${error}`);
    throw error;
  }
};
// export const getVisitorsOfBusiness = async (
//   business_id: string,
//   dateStart: string,
//   dateEnd: string,
//   offset: number,
//   sort?: SortObjectType,
// ) => {
//   try {
//     const conn = await connectToDatabase();
//     const usersCollection = conn.collection('page_data_visitor');
//     const query = usersCollection.aggregate([
//       {
//         $match: {
//           business_id: business_id,
//           created: {
//             $gte: new Date(dateStart),
//             $lt: new Date(dateEnd),
//           },
//         },
//       },
//       {
//         $group: {
//           _id: {
//             visitor_id: '$visitor_id',
//             stored_at: '$stored_at',
//             source: '$source',
//             visitor_name: '$visitor_name',
//           },
//           last_visited: { $max: '$created' },
//           referer: { $max: '$referer' },
//           purchases_count: {
//             $sum: { $cond: [{ $ne: ['$order_id', null] }, 1, 0] },
//           },
//           conversion_value: { $sum: { $ifNull: ['$conversion_value', 0] } },
//           clicks_count: {
//             $sum: { $cond: [{ $ne: ['$visitor_id', null] }, 1, 0] },
//           },
//           total_records: { $sum: 1 },
//         },
//       },
//       {
//         $sort: {
//           last_visited: -1,
//           ...(sort && { [sort.field]: sort.sort === 'asc' ? 1 : -1 }),
//         },
//       },
//       {
//         $skip: offset,
//       },
//       {
//         $limit: 10,
//       },
//     ]);

//     const results = await query.toArray();
//     return results;
//   } catch (error) {
//     console.log(`Error occurred trying to get page view: ${error}`);
//     throw error;
//   }
// };

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
  // summary:number;
}> => {
  try {
    const numberOfItems = 25;

    const conn = await connectToDatabase();
    const collection = conn.collection<Performance>('page_data_performance');

    let match: any = {
      business_id: business_id,
      created: { $gte: dateStart, $lte: dateEnd },
    };

    if (itemType) {
      match.itemType = itemType;
    }

    if (source) {
      match.source = source;
    }

    if (selected_array) {
      if (isTypeOfSelectedArray === 'selected_campaigns') {
        match.sirge_campaign_id = { $in: (selected_array) }
      } else {
        match.sirge_adset_id = { $in: (selected_array) }
      }
    }

    let filterParams: any;
    if (filterCondition) {
      if (
        filterCondition?.filterStatus === false &&
        filterCondition?.activeChecked
      ) {
        match.source_delivery_status = 'Active';
      } else if (filterCondition?.filterStatus === true) {
        // let logicalOperator = '';
        // let filterParamsTemp: any;
        // filterCondition?.Condition?.forEach((condition: any) => {
        //   if (condition.column !== '') {
        //     if (condition.operator === 'Contains') {
        //       filterParamsTemp = {
        //         [`${condition.column}`]: {
        //           $regex: `${condition.columnValue}`,
        //           $options: 'i',
        //         },
        //       };
        //     }

        //     if (condition.operator === 'Equals') {
        //       filterParamsTemp = {
        //         [`${condition.column}`]: {
        //           $regex: `^${condition.columnValue}$`,
        //           $options: 'i',
        //         },
        //       };
        //     }

        //     if (condition.operator === 'Starts with') {
        //       filterParamsTemp = {
        //         [`${condition.column}`]: {
        //           $regex: `^${condition.columnValue}`,
        //           $options: 'i',
        //         },
        //       };
        //     }

        //     if (condition.operator === 'End with') {
        //       filterParamsTemp = {
        //         [`${condition.column}`]: {
        //           $regex: `${condition.columnValue}$`,
        //           $options: 'i',
        //         },
        //       };
        //     }

        //     if (condition.operator === 'Is empty') {
        //       filterParamsTemp = {
        //         [`${condition.column}`]: { $exists: true, $eq: '' },
        //       };
        //     }

        //     if (condition.operator === 'Is not empty') {
        //       filterParamsTemp = {
        //         [`${condition.column}`]: { $exists: true, $ne: '' },
        //       };
        //     }

        //     if (condition.operator === 'Is any of') {
        //       filterParamsTemp = {
        //         [`${condition.column}`]: { $in: condition.columnValue },
        //       };
        //     }

        //     if (logicalOperator === '') {
        //       filterParams = filterParamsTemp;
        //     } else {
        //       if (logicalOperator === 'AND') {
        //         filterParams = { $and: [filterParams, filterParamsTemp] };
        //       } else {
        //         filterParams = { $or: [filterParams, filterParamsTemp] };
        //       }
        //     }

        //     logicalOperator = condition.logicalOperator;
        //   }
        // });

        filterParams = filterCondition?.Condition?.reduce((params: any, condition: any) => {
          if (condition.column === '') {
            return params;
          }
        
          let filterParamsTemp;
        
          switch (condition.operator) {
            case 'Contains':
              filterParamsTemp = { [`${condition.column}`]: { $regex: `${condition.columnValue}`, $options: 'i' } };
              break;
            case 'Equals':
              filterParamsTemp = { [`${condition.column}`]: { $regex: `^${condition.columnValue}$`, $options: 'i' } };
              break;
            case 'Starts with':
              filterParamsTemp = { [`${condition.column}`]: { $regex: `^${condition.columnValue}`, $options: 'i' } };
              break;
            case 'End with':
              filterParamsTemp = { [`${condition.column}`]: { $regex: `${condition.columnValue}$`, $options: 'i' } };
              break;
            case 'Is empty':
              filterParamsTemp = { [`${condition.column}`]: { $exists: false, $eq: '' } };
              break;
            case 'Is not empty':
              filterParamsTemp = { [`${condition.column}`]: { $exists: true, $ne: '' } };
              break;
            case 'Is any of':
              filterParamsTemp = { [`${condition.column}`]: { $in: condition.columnValue } };
              break;
            default:
              return params;
          }
        
          if (!params) {
            return filterParamsTemp;
          }
        
          if (condition.logicalOperator === 'AND') {
            return { $and: [params, filterParamsTemp] };
          }
        
          return { $or: [params, filterParamsTemp] };
        }, null);
        
      }
    }
    //-------------------------------------------------
    const aggregation = [
      {
        $match: {
          ...match,
          ...filterParams,
        },
      },
      {
        $sort: {
          [sort?.field as FieldPerformanceSortType]:
            sort?.sort === true ? 1 : -1,
        },
      },
      {
        $facet: {
          paginatedResults: [
            { $skip: numberOfPage ? numberOfItems * (numberOfPage - 1) : 0 },
            { $limit: numberOfItems },
          ],
          totalCount: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
          ],
          summary: [
            {
              $group: {
                _id: null,
                // amount_spent: { $sum: '$amount_spent' },
                // clicks: { $sum: '$sirge_clicks' },
                clicks: {  $sum: { $toInt: "$sirge_clicks" } },
                // purchases: { $sum: '$sirge_purchases' },
                // cost_per_purchase: { $sum: '$sirge_cost_per_purchase' },
                // total_conversion_value: {
                //   $sum: '$sirge_total_conversion_value',
                // },
                // roas: { $sum: { $toInt: "$sirge_roas" } },
                // ft_clicks: { $sum: '$clicks' },
                // ft_purchases: { $sum: '$purchases' },
                // ft_cost_per_purchase: { $sum: '$cost_per_purchase' },
                // ft_total_conversion_value: { $sum: '$conversion_value' },
                // ft_roas: { $sum: { $toInt: "$roas" } },
              },
            },
          ],
        },
      },
    ];

    const result = await collection.aggregate(aggregation).toArray();

    const paginatedResults =
      result[0]?.paginatedResults && result[0]?.paginatedResults?.length > 0
        ? result[0]?.paginatedResults?.map((item: any) => item)
        : [];
    const totalCount =
      result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;

      if (!result[0]?.summary?.sirge_clicks) {
        throw new Error("Clicks are not defined.");
      }
      const summary = result[0]?.summary?.sirge_clicks;
    // {
    //   amount_spent: result[0].summary.amount_spent,
    //   clicks: result[0].summary.sirge_clicks,
    //   purchases: result[0].summary.sirge_purchases,
    //   cost_per_purchase: result[0].summary.sirge_cost_per_purchase,
    //   total_conversion_value: result[0].summary.sirge_total_conversion_value,
    //   roas: result[0].summary.sirge_roas,
    //   // ft_clicks: result[0].summary.clicks,
    //   // ft_purchases: result[0].summary.purchase,
    //   // ft_cost_per_purchase: result[0].summary.cost_per_purchase,
    //   // ft_total_conversion_value: result[0].summary.total_conversion_value,
    //   // ft_roas: result[0].summary.roas,
    // };

    const totalPages = Math.ceil(totalCount / numberOfItems);

    // throw Error(result[0].summary.clicks.toString())
    return {
      performance: paginatedResults,
      numberPages:summary,
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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    await businessesCollection.updateOne(
      { user_id, business_id },
      { $set: { shopify_store_url } },
    );

    const updatedBusiness = await businessesCollection.findOneAndUpdate(
      { user_id, business_id },
      { $set: { shopify_store_url } },
      { returnDocument: 'after' },
    );

    logInfo(`db is updated: ${updatedBusiness.value}`);

    return updatedBusiness.value;
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
    const conn = await connectToDatabase();
    const businessesCollection = conn.collection('businesses');

    await businessesCollection.updateOne(
      { user_id, business_id },
      {
        $set: {
          tik_tok_ad_account_id,
          tik_tok_ad_account_name,
          tik_tok_ad_account_currency,
          tik_tok_ad_account_timezone,
        },
      },
    );

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
    const conn = await connectToDatabase();
    const analyticsCollection = conn.collection('page_data_analytics');

    const query = { business_id };
    const analytics = await analyticsCollection.findOne<Analytics>(query);

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
    const conn = await connectToDatabase();
    const analyticsCollection = conn.collection('analytics');

    const update = {
      $set: {
        'performing_product.bestPerforming': bestPerforming,
      },
    };

    await analyticsCollection.updateOne(
      { analytic_id: analytics.analytic_id },
      update,
    );
  } catch (error) {
    console.log(`Error occurred trying to update analytics: ${error}`);
    throw error;
  }
};

export const getBusinessSourcesById = async (
  business_id: string,
  dateStart?: string,
  dateEnd?: string,
  currentPage?: number,
  sort?: SourcesSortObjectType,
): Promise<{
  sources: PageView[];
  numberPages: number;
}> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const conn = await connectToDatabase();

    const pageDatasourcesCollection = conn.collection('page_data_sources');

    const numberOfItems = 25;

    const [sources, count] = await Promise.all([
      pageDatasourcesCollection
        .aggregate<PageView>([
          {
            $match: {
              business_id,
              ...(dateStart &&
                dateEnd && {
                created: {
                  $gte: `${dateStart}`,
                  $lte: `${dateEnd}`,
                },
              }),
            },
          },
          {
            $sort: { [sort?.field as string]: sort?.sort === 'desc' ? -1 : 1 },
          },
          ...(currentPage
            ? [
                { $limit: numberOfItems * currentPage },
                { $skip: (currentPage - 1) * numberOfItems },
              ]
            : []),
        ])
        .toArray(),
      await pageDatasourcesCollection.countDocuments({
        business_id,
        ...(dateStart &&
          dateEnd && {
          created: {
            $gte: `${dateStart}`,
            $lte: `${dateEnd}`,
          },
        }),
      }),
    ]);

    return {
      sources,
      numberPages: Math.ceil((count || 1) / numberOfItems),
    };
  } catch (error) {
    console.log(
      `Error occurred trying to get the source information of the business: ${business_id} ${error}`,
    );
    throw error;
  }
};

const filtersQueryMaker = (
  field: string,
  operator: string,
  value: string | number,
) => {
  let query: any = {};
  if (operator === 'Equals') {
    if (typeof value === 'number') {
      query[field] = value;
    } else {
      query[field] = { $eq: value };
    }
  } else if (operator === 'Starts with') {
    query[field] = { $regex: `^${value}` };
  } else if (operator === 'End with') {
    query[field] = { $regex: `${value}$` };
  } else if (operator === 'Contains') {
    query[field] = { $regex: value };
  } else if (operator === 'Is empty') {
    query[field] = { $exists: false };
  } else if (operator === 'Is not empty') {
    query[field] = { $exists: true };
  } else if (operator === '>') {
    query[field] = { $gt: value };
  } else if (operator === '<') {
    query[field] = { $lt: value };
  } else if (operator === '>=') {
    query[field] = { $gte: value };
  } else if (operator === '<=') {
    query[field] = { $lte: value };
  }
  return query;
};

export const getVisitorsOfBusiness = async (
  business_id: string,
  dateStart: string,
  dateEnd: string,
  offset: number,
  numberOfRecords: number,
  sort?: SortObjectType,
  filter?: FilterObjectType[],
): Promise<GetAllVisitorResponse> => {
  try {
    const conn = await connectToDatabase();
    const collection = conn.collection('page_data_visitor');

    let match: any = {
      business_id,
      date: { $gte: dateStart, $lt: dateEnd },
    };

    if (filter) {
      filter.forEach((element: FilterObjectType) => {
        if (
          element.field == 'visitor_name' ||
          element.field == 'purchases_count' ||
          element.field == 'clicks_count'
        ) {
          match = {
            ...match,
            ...filtersQueryMaker(
              element.field,
              element.operator,
              element.value,
            ),
          };
        }
      });
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            visitor_id: '$visitor_id',
            stored_at: '$date',
            sirge_source_name: '$sirge_source_name',
            visitor_name: '$visitor_name',
          },
          last_visited: { $max: '$last_visited' },
          referer: { $max: '$referer' },
          purchases_count: {
            $sum: { $cond: [{ $ne: ['$order_id', null] }, 1, 0] },
          },
          conversion_value: {
            $sum: {
              $cond: [
                { $ne: ['$conversion_value', null] },
                '$conversion_value',
                0,
              ],
            },
          },
          clicks_count: {
            $sum: { $cond: [{ $ne: ['$visitor_id', null] }, 1, 0] },
          },
        },
      },
      {
        $sort: {
          ...(sort && { [sort.field]: sort.sort === 'asc' ? 1 : -1 }),
          last_visited: -1,
        },
      },
      { $skip: offset },
      { $limit: numberOfRecords },
    ];

    // let test = await collection.aggregate(pipeline).toArray();
    const all_visitors: AllBusinessVisitor[] = (
      await collection.aggregate(pipeline).toArray()
    ).map((doc) => ({
      clicks_count: doc.clicks_count,
      conversion_value: doc.conversion_value,
      date: doc._id.stored_at,
      last_visited: doc.last_visited,
      purchases_count: doc.purchases_count,
      referer: doc.referer,
      source: doc._id.sirge_source_name,
      visitor_id: doc._id.visitor_id,
      visitor_name: doc._id.visitor_name,
    }));

    const totalRecords = await collection.countDocuments(match);

    return {
      data: all_visitors,
      totalRecords: totalRecords,
    };
  } catch (error) {
    console.log(`Error occurred trying to get page view: ${error}`);
    throw error;
  }
};

export const getVisitorsOfBusinessGraph = async (business_id: string) => {
  try {
    const conn = await connectToDatabase();
    const collectionName = 'page_data_visitors_chart';
    const collection = conn.collection(collectionName);

    const pipeline = {
      business_id: business_id,
    };

    const res = await collection.find(pipeline).toArray();

    return res;
  } catch (error) {
    console.log(`Error occurred trying to get page view: ${error}`);
    throw error;
  }
};
export const updateMontlyBudget = async (data: UpdateMonthlyBudgetInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const conn = await connectToDatabase();

    const analyticsCollection = conn.collection('analytics');

    await analyticsCollection.updateOne(
      { analytic_id: data.analytic_id },
      {
        $set: {
          'monthly_budget.total': data.amount,
        },
      },
    );
  } catch (error) {
    console.log(`Error occurred trying to update monthly budget: ${error}`);
    throw error;
  }
};

export const updateRoasGoals = async (data: UpdateRoasGoalsInput) => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    type UpdateRoasGoalsKeys = 'campaigns' | 'ads' | 'adsets';

    const conn = await connectToDatabase();
    const analyticsCollection = conn.collection('analytics');

    const dataKeys = Object.keys(data).filter(
      (key) => key !== 'analytic_id',
    ) as UpdateRoasGoalsKeys[];

    const updateObj: any = {};

    if (data[dataKeys[0]]) {
      updateObj[`roas_goals.${dataKeys[0]}.goal`] = data[dataKeys[0]];
    }
    if (data[dataKeys[1]]) {
      updateObj[`roas_goals.${dataKeys[1]}.goal`] = data[dataKeys[1]];
    }
    if (data[dataKeys[2]]) {
      updateObj[`roas_goals.${dataKeys[2]}.goal`] = data[dataKeys[2]];
    }

    await analyticsCollection.updateOne(
      { analytic_id: data.analytic_id },
      { $set: updateObj },
    );
  } catch (error) {
    console.log(`Error occurred trying to update monthly budget: ${error}`);
    throw error;
  }
};
