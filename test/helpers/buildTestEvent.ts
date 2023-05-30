import { AppSyncResolverEvent } from 'aws-lambda';

interface buildTestEventProps<T> {
  userId: string;
  group: 'Managers' | 'Staff';
  managerUserId?: string;
  requestPayload: T;
  useApiKey?: boolean;
}

export const buildTestEvent = <TArgs = Record<string, any>>({
  userId,
  group,
  managerUserId,
  requestPayload,
  useApiKey = false,
}: buildTestEventProps<TArgs>): AppSyncResolverEvent<
  TArgs,
  Record<string, any> | null
> => {
  if (group === 'Staff' && !managerUserId) {
    throw new Error('Staff account needs a manager');
  }

  return {
    arguments: requestPayload,
    identity: {
      claims: {
        manager_id: managerUserId,
      },
      sub: userId,
      groups: [group],
      issuer: '',
      username: '',
      sourceIp: [],
      defaultAuthStrategy: '',
    },
    source: {},
    request: {
      headers: {
        'x-api-key': (useApiKey && process.env.COGNITO_X_API_KEY) || '',
      },
      domainName: null,
    },
    info: {
      variables: {},
      selectionSetList: [],
      selectionSetGraphQL: '',
      parentTypeName: '',
      fieldName: '',
    },
    prev: null,
    stash: {},
  };
};
