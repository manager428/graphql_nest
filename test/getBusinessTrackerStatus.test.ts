import { Callback, Context } from 'aws-lambda';
import {
  Result,
  BusinessActiveStatus,
  SuccessResponse,
  ErrorResponse,
} from '../shared/types';
import {
  GetBusinessTrackerStatusParams,
  handler,
} from '../lambda-handlers/get-business-trackerstatus';
import { buildTestEvent } from './helpers/buildTestEvent';
import { getTestContext } from './helpers/getTestContext';

describe('test getting businessTrackStatus', () => {
  let context: Context;
  let callback: Callback<Result<BusinessActiveStatus>>;

  beforeEach(() => {
    context = getTestContext();
    callback = () => {};
  });

  it('verifies error response when active business_id does not exist in businesses table', async () => {
    const event = buildTestEvent<GetBusinessTrackerStatusParams>({
      userId: 'b630b807-fe63-4aae-a2e7-a783ca9ae87f',
      group: 'Managers',
      requestPayload: {
        getBusinessesInput: {
          business_id: '01fba9f8-c3b6-4963-a134-2fecd5311dc6',
        },
      },
    });

    const result = (await handler(event, context, callback)) as ErrorResponse;
    const { error } = result;

    expect(error).toBeDefined();
    expect(error).not.toBeNull();
    expect(error?.message).toEqual('No business found.');
  });
});
