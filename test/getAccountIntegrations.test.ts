import { Callback, Context } from 'aws-lambda';
import {
  AccountIntegration,
  GetAccountIntegrationsParams,
  handler,
} from '../lambda-handlers/get-account-integrations';
import { Result, SuccessResponse } from '../shared/types';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

describe('test getting account integrations', () => {
  let context: Context;
  let callback: Callback<Result<AccountIntegration[]>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('should successfull return integrations', async () => {
    const event = buildTestEvent<GetAccountIntegrationsParams>({
      userId: '6daadd85-784c-45d6-a724-87dcbe43930b',
      group: 'Staff',
      managerUserId: 'dee37734-bce3-448a-9ab0-130046ccc4d6',
      requestPayload: {},
    });

    const result = (await handler(event, context, callback)) as SuccessResponse<
      AccountIntegration[]
    >; // Expecting a response, so AS it

    const { data } = result;

    expect(data).toBeDefined();
    expect(data).not.toBeNull();
  });
});
