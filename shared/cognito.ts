import AWS from 'aws-sdk';
import {
  ChangePasswordInput,
  PasswordResetInput,
  StaffAccountInput,
  UserInput,
} from './types';
import { AccessKeys } from '@sirge-io/sirge-utils';
import { getAwsKeys } from './config';

const keys: AccessKeys = {};

const setConfig = async () => {
  try {
    const keys = await getAwsKeys();
    //These should only ever be defined in a .env for local development.
    //If they are defined this AWS.config.update needs to run to set the role that the lambda should access dynamoDB under
    if (keys.accessKey && keys.accessSecret) {
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

export const changePassword = async (
  changePasswordInput: ChangePasswordInput,
): Promise<AWS.CognitoIdentityServiceProvider.AdminSetUserPasswordResponse> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const cognito = new AWS.CognitoIdentityServiceProvider();
    const params: AWS.CognitoIdentityServiceProvider.AdminSetUserPasswordRequest =
      {
        UserPoolId: process.env.USER_POOL_ID as string,
        Username: changePasswordInput.email,
        Password: changePasswordInput.password,
        Permanent: true,
      };

    return await cognito.adminSetUserPassword(params).promise();
  } catch (error) {
    console.log(
      `Error occurred trying to change password cognito user: ${changePasswordInput.email}} ${error}`,
    );
    throw error;
  }
};

export const passwordReset = async (
  passwordResetInput: PasswordResetInput,
): Promise<AWS.CognitoIdentityServiceProvider.ForgotPasswordResponse> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const cognito = new AWS.CognitoIdentityServiceProvider();
    const params: AWS.CognitoIdentityServiceProvider.ForgotPasswordRequest = {
      ClientId: process.env.USER_POOL_CLIENT_ID as string,
      Username: passwordResetInput.email,
    };

    return await cognito.forgotPassword(params).promise();
  } catch (error) {
    console.log(
      `Error occurred trying to reset password cognito user: ${passwordResetInput.email} ${error}`,
    );
    throw error;
  }
};

export const registerCognitoUser = async (
  userInput: UserInput,
): Promise<AWS.CognitoIdentityServiceProvider.SignUpResponse> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const cognito = new AWS.CognitoIdentityServiceProvider();

    const registerUserParams: AWS.CognitoIdentityServiceProvider.SignUpRequest =
      {
        ClientId: process.env.USER_POOL_CLIENT_ID as string,
        Username: userInput.email,
        Password: userInput.password,
      };

    const confirmUserParams: AWS.CognitoIdentityServiceProvider.AdminConfirmSignUpRequest =
      {
        UserPoolId: process.env.USER_POOL_ID as string,
        Username: userInput.email,
      };

    const user = await cognito.signUp(registerUserParams).promise();

    /**
     * TODO: fix to execute confirm user. it works fine but throws error at the end. Need to figure out why?
     */
    try {
      await cognito.adminConfirmSignUp(confirmUserParams).promise();
    } catch (error) {}

    return user;
  } catch (error) {
    console.log(
      `Error occurred trying to register cognito user: ${userInput.email} ${error}`,
    );
    throw error;
  }
};

export const addUserToGroup = async (params: {
  GroupName: string;
  UserPoolId: string;
  Username: string;
}): Promise<{} | AWS.AWSError> => {
  try {
    const cognito = new AWS.CognitoIdentityServiceProvider();

    return new Promise((resolve, reject) => {
      cognito.adminAddUserToGroup(params, (err, data) => {
        if (err) {
          console.log(err, err.stack); // an error occurred
          reject(err);
        } else {
          resolve(data); // successful response
        }
      });
    });
  } catch (error) {
    console.log(
      `Error occurred trying to add group to cognito user: ${params.Username} ${error}`,
    );
    throw error;
  }
};

export const registerStaffUser = async (
  staffInput: StaffAccountInput,
  managerId: string,
): Promise<AWS.CognitoIdentityServiceProvider.SignUpResponse> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const cognito = new AWS.CognitoIdentityServiceProvider();
    const params: AWS.CognitoIdentityServiceProvider.SignUpRequest = {
      ClientId: process.env.USER_POOL_CLIENT_ID as string,
      Username: staffInput.email,
      Password: staffInput.password,
      UserAttributes: [
        {
          Name: 'custom:manager_id',
          Value: managerId,
        },
      ],
    };

    return await cognito.signUp(params).promise();
  } catch (error) {
    console.log(
      `Error occurred trying to register cognito user: ${staffInput.email} ${error}`,
    );
    throw error;
  }
};

export const deleteStaffUserCognito = async (staffId: string): Promise<{}> => {
  try {
    if (!Object.entries(keys).length) {
      await setConfig();
    }

    const cognito = new AWS.CognitoIdentityServiceProvider();
    const params: AWS.CognitoIdentityServiceProvider.AdminDeleteUserRequest = {
      UserPoolId: process.env.USER_POOL_ID as string,
      Username: staffId,
    };

    return await cognito.adminDeleteUser(params).promise();
  } catch (error) {
    console.log(
      `Error occurred trying to delete cognito user: ${staffId} ${error}`,
    );
    throw error;
  }
};
