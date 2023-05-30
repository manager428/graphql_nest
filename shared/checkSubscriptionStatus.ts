import { StatusCodeError } from './statusCodes';
import { User, SubscriptionStatuses } from '@sirge-io/sirge-utils';

/**
 * Checks if the user has a subscription. Throws if no subscription is found
 *
 * @param {User} user
 * @returns {SubscriptionStatuses}
 */
export const checkSubscriptionStatus = (user: User): SubscriptionStatuses => {
  const subscriptionId = user?.subscription_id || user.subscription.id;

  if (!subscriptionId) {
    throw new StatusCodeError(31);
  }

  const subscriptionStatus =
    user.subscription_status || user?.subscription?.status;

  if (
    ![SubscriptionStatuses.ACTIVE, SubscriptionStatuses.TRIALING].includes(
      subscriptionStatus,
    )
  ) {
    throw new StatusCodeError(88);
  }

  return subscriptionStatus;
};
