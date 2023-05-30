import AWS from 'aws-sdk';
import crypto from 'crypto';

const mockCognitoResponse = {
  UserConfirmed: false,
  CodeDeliveryDetails: {
    Destination: 'a***@s***',
    DeliveryMedium: 'EMAIL',
    AttributeName: 'email',
  },
  UserSub: crypto.randomUUID(),
};

export const cognitoRegister = () => {
  jest
    .spyOn(
      Object.getPrototypeOf(new AWS.CognitoIdentityServiceProvider()),
      'signUp',
    )
    .mockReturnValue({
      promise: () => Promise.resolve(mockCognitoResponse),
    });
};
