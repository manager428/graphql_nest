import { UserPoolOperation } from 'aws-cdk-lib/aws-cognito';
import { AccountStates } from '../enums/accountStates';
import { SubscriptionStatuses, User } from '@sirge-io/sirge-utils';
import { MarketingSources } from '@sirge-io/sirge-utils';
import { StatusReasonMessage } from 'aws-sdk/clients/licensemanager';
import { Business } from '@sirge-io/sirge-types';

/** @deprecated use from sirge-util repo */
export type CDKContext = {
  appName: string;
  region: string;
  environment: string;
  branchName: string;
  accountNumber: string;
  userPoolId: string;
};

/** @deprecated use from sirge-util repo */
export type LambdaDefinition = {
  name: string;
  cognitoProps?: CognitoProps;
  resolverProps?: ResolverProps;
  memoryMB?: number;
  timeoutMins?: number;
  environment?: LambdaEnvironment;
};

/** @deprecated use from sirge-util repo */
export type CognitoGroupDefinition = {
  id: string;
  groupName: CognitoGroupName;
  description?: string;
};

/** @deprecated use from sirge-util repo */
export type CognitoGroupName = 'Admins' | 'Managers' | 'Staff';

/** @deprecated use from sirge-util repo */
export type CognitoProps = {
  operation: string;
};

/** @deprecated use from sirge-util repo */
export type ResolverProps = {
  dataSourceName: string;
  typeName: string;
  fieldName: string;
};

/** @deprecated use from sirge-util repo */
export type LambdaEnvironment = {
  [key: string]: string;
};

/** @deprecated use from sirge-util repo */
export type AccessKeys = {
  accessKey?: string | undefined;
  accessSecret?: string | undefined;
};

export type GetBusinessParams = {
  getBusinessesInput: {
    nextToken?: string;
    business_id?: string;
  };
  getBusinessStatusInput?: {
    business_id: string;
    user_id: string;
    status: string;
  };
};

export type SetBusinessParams = {
  setBusinessesInput: {
    nextToken?: string;
    business_id: string;
    business_name: string;
  };
};

export type DeleteBusinessParams = {
  deleteBusinessesInput: {
    nextToken?: string;
    business_id: string;
    two_factor_code: string;
  };
};

export type VerifyTwoFactorParams = {
  verifyTwoFactorInput: {
    two_factor_id: string;
  };
};

export type RefreshDataByBusinessParams = {
  refreshDataForBusinessInput: {
    business_id: string;
  };
};

export type ChangePasswordParams = {
  changePasswordInput: {
    two_factor_id: string;
    password: string;
  };
};

export type GetPageViewParams = {
  getPageViewInput: {
    business_id: string;
    pageview_id: string;
  };
};

export type GenerateUploadUrlInput = {
  generateUploadUrlInput: {
    business_id?: string;
    extension_type: string;
    content_type: string;
  };
};

export type UpdateBusinessLogoInput = {
  updateBusinessLogoInput: {
    business_id: string;
    file_url: string;
  };
};

export type UpdateUserProfilePictureInput = {
  updateUserProfilePictureInput: {
    user_id: string;
    file_url: string;
  };
};

export type UploadLogoParams =
  | GenerateUploadUrlInput
  | UpdateBusinessLogoInput
  | UpdateUserProfilePictureInput;

export type S3PresignParams = {
  Bucket: string;
  Key: string;
  Body?: string;
  Expires: number;
  ContentType?: string;
  ACL?: string;
};

/** @deprecated use from sirge-util repo */
export type AddBusinessParams = {
  addBusinessInput: {
    user_id: string;
    status: string;
    //TODO need to revisit to see what else might be needed
    //when creating a new business
    //would think we need country, currency, culture_info, preferred language, etc etc
  };
};

export type UpdateSubscriptionCardParams = {
  updateUserSubscriptionCardInput: UpdateUserSubscriptionCardInput;
};

export type UpdateUserSubscriptionCardInput = {
  payment_method?: string;
  card_number: string;
  card_last_four_digits: string;
  card_expiry_date: string;
  card_type: string;
  card_cvc: string;
};
export type UpdateFacebookConnectionSettingsParams = {
  updateFacebookConnectionSettingsInput: UpdateFacebookConnectionSettingsInput;
};
export type UpdateFacebookConnectionSettingsInput = {
  business_id: String!;
  fb_pixel_id: Int!;
};

export type UpdateBusinessParams = {
  updateBusinessStatusInput: {
    user_id: string;
    business_id: string;
    status: string;
  };
};

export type CountBusinessByStatusInput = {
  user_id: string;
  status: string;
};

export type ActivateBusinessParams = {
  activateBusinessInput: {
    business_id: string;
  };
};

export type DeactivateBusinessParams = {
  deactivateBusinessInput: {
    business_id: string;
  };
};

export type AdAccountTikTokParams = {
  AdAccountTiktokBussinesInput: {
    business_id: string;
    tik_tok_ad_account_id: string;
    tik_tok_ad_account_name: string;
  };
};

export type TikTokBusinessAdAccountResponse = {
  name: string;
  timezone: string;
  currency: string;
};

/** @deprecated might be removed */
export type TikTokAdSetParams = {
  TikTokAdSetInput: {
    business_id: string;
    date_from: Date;
    date_to: Date;
    exchange_rate_date?: Date;
    source: string[];
    selected_campaigns: number[];
  };
};

export type TikTokBusinessAdGroupResponse = {
  list: T[];
  page_info: {
    page: number;
    page_size: number;
    total_number: number;
    total_page: number;
  };
};

export type TikTokAdParams = {
  TikTokAdInput: {
    business_id: string;
    date_from: Date;
    date_to: Date;
    exchange_rate_date?: Date;
    source: string[];
    selected_campaigns: number[];
    selected_ad_sets: number[];
  };
};

/** Resolver response */
type SuccessResponse<T> = {
  data?: T | null;
  message?: string;
  nextToken?: string | null;
  numberOfPages?: number;
};

type ErrorResponse = {
  error: { code: number; message: string; nextToken?: string };
};

export type Result<T> = SuccessResponse<T> | ErrorResponse;

export type RegisterUserParams = {
  registerUserInput: UserInput;
};

export type PasswordResetParams = {
  passwordResetInput: PasswordResetInput;
};

type UserInput = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  shopify_store_url: string;
};

/** @deprecated use from sirge-util repo */
type PasswordResetInput = {
  email: string;
};

type ChangePasswordInput = {
  two_factor_id?: string;
  password: string;
  email: string;
};

export type CreateStaffAccountParams = {
  createStaffAccountInput: StaffAccountInput;
};

/** @deprecated use from sirge-util repo */
export type UpdateTimezoneCurrencyParams = {
  updateTimezoneCurrencyInput: UpdateTimezoneCurrencyInput;
};

/** @deprecated use from sirge-util repo */
export type StaffAccountInput = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

/** @deprecated use from sirge-util repo */
export type UpdateAutoScalingSettingInput = {
  user_id: string;
  auto_scale_value: number;
};

export type RemoveFacebookAdAccountInput = {
  business_id: string;
  fb_pixel_id?: number | string | null;
  facebook_ad_account_id?: string | null;
  facebook_ad_account_name?: string | null;
  facebook_ad_account_currency?: string | null;
  facebook_ad_account_timezone?: string | null;
};

/** @deprecated use from sirge-util repo */
/** TODO: this interface will need to be updated in sirge utils */
export type UpdateTimezoneCurrencyInput = {
  user?: User;
  timezone: string;
  currency: string;
};
/** @deprecated use from sirge-util repo */
export type DeleteStaffAccountParams = {
  deleteStaffAccountInput: DeleteStaffAccountInput;
};

/** @deprecated use from sirge-util repo */
export type DeleteStaffAccountInput = {
  staff_id: string;
};

export type CreateBusinessParams = {
  createBusinessInput: {
    business_name: string;
  };
};

export type SaveNewBusinessInput = {
  business_id: string;
  status: string;
  user_id: string;
  vanity_name: string;
  business_name: string;
};

export type GetBusinessByVanityNameParams = {
  getBusinessByVanityNameInput: {
    vanity_name: string;
  };
};

export type GetBusinessByVanityName = {
  getUserBusinessByVanityNameInput: {
    vanity_name: string;
    user_id: string;
  };
};

export type DisconnectBusinessTikTokParams = {
  disconnectBusinessTiktokInput: DisconnectBusinessTikTokInput;
};

export type DisconnectBusinessTikTokInput = {
  business_id: string;
};

export type SetFacebookUserAccessInput = {
  user: User;
  facebook_userID: string | null;
  facebook_accessToken: string | null;
};

export type FacebookIntegrationStatus = 'true' | 'false' | 'expired';

/** Exchange rates */

export type FacebookAccessInput = {
  facebook_userID: string;
  facebook_accessToken: string;
};

export type FacebookAdAccount = {
  name: string;
  currency: string;
};

export type ApplyPromoCodeInput = {
  code: string;
};

export type AuthenticateTikTokParams = {
  authenticateTikTokInput: AuthenticateTikTokInput;
};

export type AuthenticateTikTokInput = {
  auth_code: string;
};

export type PayInvoiceInput = {
  invoice_id: string;
};

export type InvoiceObject = {
  invoice_id: string;
  invoice_number: number;
  total: number;
  created: string;
  status: string;
  invoice_pdf: string;
};

export type SubscribeInput = {
  plan_code: string;
};

// add to sirge-utils package
export type UserSubscriptionInput = {
  user: User;
  business_limit: number;
  plan_price_id: string;
  plan_product_id: string;
  subscription_id: string;
  subscription_status: string;
  current_billing_period_start: number | null;
  current_billing_period_end: number | null;
};

export type ConnectUserTikTokParams = {
  getUserTiktokAdsInput: {
    tik_tok_access_token: string;
  };
};

export type GetUserSessionParams = {};

export type GetEventLogUsageToDateByBusinessParams = {};

export type GetEventLogUsageLastThreeMonthsParams = {};

export type EventLogUsage = {
  labels: string[];
  values: number[];
};

export type UserSession = {
  browser_name: string;
  browser_version: string;
  created_at: string;
  ip: string;
  location: string;
  os_name: string;
  os_version: string;
  user_id: string;
};

export type UpdateSubscriptionItemQuantityParams = {
  subscription_id: string;
  subscription_item_id: string;
  option?: number;
};

export type ItemQuantityResult = {
  limit: number;
  quantity: number;
};

export type BusinessActiveStatus = {
  active: boolean;
};

export type BusinessParams = {
  businessInput: {
    business_id: string;
  };
};

export type BusinessPageViewPurchase = {
  purchase: PurchaseView;
};

export type PurchaseView = {
  first_touch_campaign: string;
  first_touch_ad_set: string;
  first_touch_ad: string;
  last_touch_campaign: string;
  last_touch_ad_set: string;
  last_touch_ad: string;
};

export type FacebookCampaign = {
  facebook: string | boolean;
  campaigns_data: T;
};

export type UserSession = {
  browser_name: string;
  browser_version: string;
  created_at: string;
  ip: string;
  location: string;
  os_name: string;
  os_version: string;
  user_id: string;
};

export type BusinessVisitor = {
  visitor_name: String;
  visitor_email: String;
  visitor_phone: String;
  visitor_address: VisitorAddressParam | null;
  sources: PageViewNum[];
  page_views: PageViewNum[];
  total_spent: number;
  total_page_views: number;
  total_purchases: String;
  external_customer_url: String | null;
  external_platform: String | null;
  geolocation: VisitorGeolocation;
  first_visit: String;
  total_spent_query: PageView[];
};

export type VisitorGeolocation = {
  lat: string | null;
  long: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
};

export type PageViewNum = {
  data: PageView;
  id: number;
};

export type VisitorAddressParam = {
  line1: string;
  city: string;
  province: string;
  country: string;
};

export type GetUserSessionParams = {};

export type GetBusinessAdsParams = {
  business_id: string;
  date_from?: string;
  date_to?: string;
  source: string;
  selected_campaigns?: string[];
  selected_ad_sets?: string[];
};

export type Ads = {
  source: string;
  purchases_count: number;
  clicks_count: number;
  conversion_value: number;
  ad_set: string;
  ad: string;
  ad_set_name?: string;
  amount_spent: number;
  clicks: number;
  cost_per_purchase: number;
  id: number;
  purchases: number;
  roas: string;
  sirge_adset_id?: string;
  sirge_clicks: number;
  sirge_cost_per_purchase: number | null;
  sirge_purchases: number;
  sirge_roas: number | string | null;
  sirge_total_conversion_value: number;
  source_delivery_status?: string | null;
  total_conversion_value: number;
  total_title?: string;
  sirge_ad_id: string;
  ad_name?: string;
};

export type AdsFacebook = {
  id: number;
  total_title?: string;
  source_delivery_status?: string | null;
  sirge_ad_id?: string;
  ad_name?: Ads;
  campaign_name?: string;
  amount_spent: number;
  clicks: number | null;
  purchases: number | null;
  cost_per_purchase: number | null;
  total_conversion_value: number | null;
  roas: string | null;
  sirge_clicks: number | null;
  sirge_purchases: number | null;
  sirge_cost_per_purchase: number | null;
  sirge_total_conversion_value: number | null;
  sirge_roas: string | null;
};

export type FacebookAdSet = {
  account_id: string;
  effective_status: string;
};

interface FacebookAction {
  action_type: 'omni_purchase' | 'link_click' | 'purchase';
  value: number;
}

export type FacebookInsight = {
  action_values: FacebookAction[];
  spend: number;
  adset_name: string;
  purchase_roas: FacebookAction[];
  actions: FacebookAction[];
  cost_per_action_type: FacebookAction[];
};

type BusinessAdSetInput = {
  business_id: string;
  date_from?: string;
  date_to?: string;
  source: MarketingSources;
  selected_campaigns?: number[];
};

export type GetBusinessAdSetParams = {
  getBusinessAdSetInput: BusinessAdSetInput;
};

export type UpdateUserParams = {
  updateUserInput: {
    first_name: string;
    last_name: string;
    full_address: string;
    postal_code: string;
    country_name: string;
    country_code: string;
  };
};

export type UpdateSubscriptionPlanParams = {
  updateSubscriptionPlanInput: {
    to_plan_code: string;
  };
};

export type GetStaffByIdParams = {
  getStaffByIdInput: {
    staff_id: string;
  };
};

export type GetBusinessPerformanceParams = {
  getPerformanceDetailsInput: {
    business_id: string;
    itemType: string;
    source?: string;
    selected_campaigns?: string[];
    selected_ad_sets?: string[];
    sort?: PerformanceSortObjectType;
    filterCondition?: filterConditionType;
    numberOfPage?: number;
    dateStart: string;
    dateEnd: string;
  };
};

export type FieldPerformanceSortType =
  | 'date_start'
  | 'source_delivery_status'
  | 'clicks'
  | 'source'
  | 'amount_spent'
  | 'itemType'
  | 'purchases'
  | 'cost_per_purchase'
  | 'total_conversion_value'
  | 'roas'
  | 'campaign_name';

export type PerformanceSortObjectType = {
  sort: boolean;
  field: FieldPerformanceSortType;
};

type filterConditionType = {
  Condition: filterConditionArg[];
  filterStatus: boolean;
  activeChecked: boolean;
  roasToggle: number;
};

type filterConditionArg = {
  column: string;
  operator: string;
  columnValue: any;
  logicalOperator: string;
};

export type UpdateShopifyUrlParams = {
  updateShopifyStoreUrlInput: {
    business_id: string;
    shopify_url: string;
  };
};

export type GetBusinessAnalyticsParams = {
  getBusinessAnalyticsInput: {
    business_id: string;
  };
};

export type LineItem = {
  name: string;
  price: string;
  quantity: number;
  id: number;
  product_id: number;
};
export type Order = {
  id: number;
  created_at: string;
  order_number: number;
  line_items: LineItem[];
};
export type OrderProduct = {
  product_id: number;
  name: string;
  totalPrice: number;
  ordersCount: number;
};
export type OrderResult = {
  daily: OrderProduct[];
  weekly: OrderProduct[];
  monthly: OrderProduct[];
};

export type TiktokAds = {
  advertiser_id: string;
  advertiser_name: string;
};

export type TikTokBusinessCampignResponse = {
  code: number;
  message: string;
  data: {
    list: T[];
    page_info: {
      page: number;
      page_size: number;
      total_number: number;
      total_page: number;
    };
  };
};

export type FacebookReponse = {
  data: T[];
  paging: {
    cursors: {
      before: string;
      after: string;
    };
  };
};

export type CurrentUserBusinessDetails = {
  business?: Business;
  businesses: {
    business_list: Business[];
    business_count: number;
    business_active_count: number;
  };
  status: {
    active: boolean;
  };
};

export type getCurrentUserBusinessParams = {
  getCurrentUserBusinessDetailsInput: {
    vanity_name: string;
  };
};

export type UpdateMonthlyBudgetParams = {
  updateMonthlyBudgetInput: UpdateMonthlyBudgetInput;
};
export type UpdateMonthlyBudgetInput = {
  analytic_id: string;
  amount: number;
};

export type UpdateRoasGoalsParams = {
  updateRoasGoalsInput: UpdateRoasGoalsInput;
};
export type UpdateRoasGoalsInput = {
  analytic_id: string;
  campaigns?: number;
  ads?: number;
  adsets?: number;
};

export type SortType = 'asc' | 'desc';
export type FieldSourcesSortType =
  | 'created'
  | 'purchases_count'
  | 'clicks_count'
  | 'source';

export type SourcesSortObjectType = {
  sort: SortType;
  field: FieldSourcesSortType;
};

export type PerformanceSummary = {
  amount_spent: number;
  clicks: number;
  purchases: number;
  cost_per_purchase: number;
  total_conversion_value: number;
  roas: string;
  ft_clicks: number;
  ft_purchases: number;
  ft_cost_per_purchase: number;
  ft_total_conversion_value: number;
  ft_roas: string;
};
