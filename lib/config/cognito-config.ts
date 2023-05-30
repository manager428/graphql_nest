import { CDKContext, CognitoGroupDefinition } from '@sirge-io/sirge-utils';

export const getCognitoGroupDefinitions = (
  context: CDKContext,
): CognitoGroupDefinition[] => {
  const lambdaDefinitions: CognitoGroupDefinition[] = [
    {
      id: 'admins-group',
      groupName: 'Admins',
    },
    {
      id: 'managers-group',
      groupName: 'Managers',
    },
    {
      id: 'staff-group',
      groupName: 'Staff',
    },
  ];
  return lambdaDefinitions;
};
