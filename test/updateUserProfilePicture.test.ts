import { User } from '@sirge-io/sirge-utils';
import { AppSyncIdentityCognito, Callback, Context } from 'aws-lambda';
import AWS from 'aws-sdk';
import {
  Result,
  SuccessResponse,
  UpdateUserProfilePictureInput,
} from '../shared/types';
import { handler } from './../lambda-handlers/update-user-profile-picture';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

require('dotenv').config();

describe('Test for app handler', () => {
  beforeAll(() => {
    if (process.env.ACCESS_KEY_ID && process.env.SECRET_ACCESS_KEY) {
      AWS.config.update({
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
        region: 'us-west-2',
      });
    }
  });

  it('verifies successful response', async () => {
    const event = buildTestEvent<UpdateUserProfilePictureInput>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {
        updateUserProfilePictureInput: {
          user_id: '6daadd85-784c-45d6-a724-87dcbe43930b',
          file_url: 'https://via.placeholder.com/150',
        },
      },
    });

    const context = getTestContext();

    const callback: Callback<Result<User | null>> = () => {};

    const result = (await handler(
      event,
      context,
      callback,
    )) as SuccessResponse<User>; // Expecting a response, so AS it

    const { data, message } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();

    expect(data?.user_id).toEqual(
      (event.identity as AppSyncIdentityCognito).sub,
    );
    expect(data?.profile_photo).toBeDefined();
    expect(data?.profile_photo).toEqual(
      event.arguments.updateUserProfilePictureInput.file_url,
    );
    expect(message).toEqual('Profile photo updated successfully');
  });
});
