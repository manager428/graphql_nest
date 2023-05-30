import { FacebookAdStatuses } from './enums/facebookAdStatuses';
import { StatusCodeError } from './statusCodes';
import { FacebookReponse } from './types';
require('dotenv').config();

const HOST = process.env.FB_HOST as RequestInfo;

export enum FacebookGrantTypes {
  FB_EXCHANGE_TOKEN = 'fb_exchange_token',
  CLIENT_CREDENTIALS = 'client_credentials',
}

interface ErrorResponse {
  error: Error;
}

interface Error {
  message: string;
  type: string;
  code: number;
  fbtrace_id: string;
}

export const exchangeFacebookToken = (
  facebookAccessToken: string,
): Promise<Response> => {
  const url = `${HOST}/oauth/access_token?grant_type=${FacebookGrantTypes.FB_EXCHANGE_TOKEN}&client_id=${process.env.FB_CLIENT_ID}&client_secret=${process.env.FB_SECRET_KEY}&fb_exchange_token=${facebookAccessToken}`;

  return fetch(url);
};

export const getFacebookAccount = async (
  facebookAccessToken: string,
): Promise<Response> => {
  const url = `${HOST}/me?fields=id,name&access_token=${facebookAccessToken}`;

  return fetch(url);
};

export const getFacebookAdSet = (
  facebookAdSetId: string,
  facebookAccessToken: string,
): Promise<Response> => {
  const url = `${HOST}/${facebookAdSetId}?fields=account_id,effective_status&access_token=${facebookAccessToken}`;

  return fetch(url);
};

export const getFacebookInsights = (
  facebookAdSetId: string,
  facebookAccessToken: string,
  dateFrom: string,
  dateTo: string,
): Promise<Response> => {
  const url = `${HOST}/${facebookAdSetId}/insights?time_range={'since':'${dateFrom}','until':'${dateTo}'}&fields=action_values,spend,adset_name,purchase_roas,actions,cost_per_action_type&use_unified_attribution_setting=true&access_token=${facebookAccessToken}`;

  return fetch(url);
};

export const getFacebookAdAccounts = async (
  facebookUserId: string,
  facebookAccessToken: string,
): Promise<Response> => {
  const url = `${HOST}/${facebookUserId}/adaccounts?limit=10000000&fields=name,currency&access_token=${facebookAccessToken}`;

  return fetch(url);
};

export const setFacebookAdAccount = async (
  facebookAdAccountId: string,
  facebookAccessToken: string,
) => {
  const url = `${HOST}/${facebookAdAccountId}?fields=timezone_name&access_token=${facebookAccessToken}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const { error } = (await response.json()) as ErrorResponse;
    throw new Error(
      `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
    );
  }

  const result = (await response.json()) as {
    timezone_name?: string;
    error?: string;
  }; // this is ugly but I was not able to test this to get the typing I need, so this was a best guess

  return result;
};

export const getFacebookAdAccountCampaign = async (
  facebookAdAccountId: string,
  facebookAccessToken: string,
) => {
  try {
    const url = `${HOST}/${facebookAdAccountId}/campaigns?fields=name&access_token=${facebookAccessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      const { error } = (await response.json()) as ErrorResponse;
      throw new Error(
        `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
      );
    }

    return { data: response, ok: response.ok };
  } catch (error) {
    console.log(
      `Error occurred trying to get facebook account: FB Account ID: ${facebookAdAccountId}`,
    );
    throw error;
  }
};

export const getFacebookCampaigns = async (
  facebookAccessToken: string,
  facebookAdAccountId: string,
) => {
  try {
    const url = `${HOST}/${facebookAdAccountId}?fields=account_id,effective_status&access_token=${facebookAccessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      const { error } = (await response.json()) as ErrorResponse;
      throw new Error(
        `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
      );
    }

    const { data } = await response.json();

    return data.effective_status;
  } catch (error) {
    console.log(
      `Error occurred trying to get campaigns from facebook account. FB Account ID: ${facebookAdAccountId}`,
    );
    throw error;
  }
};

export const getFacebookAds = async (
  facebookAdAccountId: string,
  facebookAccessToken: string,
) => {
  try {
    const url = `${HOST}/${facebookAdAccountId}?fields=account_id,effective_status&access_token=${facebookAccessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      const { error } = (await response.json()) as ErrorResponse;
      throw new Error(
        `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
      );
    }

    const { data } = await response.json();

    return data;
  } catch (error) {
    console.log(
      `Error occurred trying to get campaigns from facebook account. FB Account ID: ${facebookAdAccountId}`,
    );
    throw error;
  }
};

export const getFacebookReports = async (
  facebookAccessToken: string,
  facebookAdAccountId: string,
  facebookDateFrom: string,
  facebookDateTo: string,
) => {
  try {
    const url = `${HOST}/${facebookAdAccountId}/insights?time_range={'since': '${facebookDateFrom}': 'util': '${facebookDateTo}'}&fields=action_values,spend,campaign_name,purchase_roas,actions,cost_per_action_type&use_unified_attribution_setting=true&access_token=${facebookAccessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      const { error } = (await response.json()) as ErrorResponse;
      throw new Error(
        `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
      );
    }

    const { data } = await response.json();

    return data;
  } catch (error) {
    console.log(
      `Error occurred trying to get campaigns from facebook account FB Account ID: ${facebookAdAccountId}`,
    );
    throw error;
  }
};

export const getFacebookAdsReports = async (
  facebookAdAccountId: string,
  facebookDateFrom: string,
  facebookDateTo: string,
  facebookAccessToken: string,
) => {
  try {
    const url = `${HOST}/${facebookAdAccountId}/insights?time_range={'since': '${facebookDateFrom}': 'until': '${facebookDateTo}'}&fields=action_values,spend,adset_name,purchase_roas,actions,cost_per_action_type&use_unified_attribution_setting=true&access_token=${facebookAccessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      const { error } = (await response.json()) as ErrorResponse;
      throw new Error(
        `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
      );
    }

    const { data } = await response.json();

    return data;
  } catch (error) {
    console.log(
      `Error occurred trying to get campaigns from facebook account FB Account ID: ${facebookAdAccountId}`,
    );
    throw error;
  }
};

export const updateFacebookAdStatus = async (
  adId: string,
  status: FacebookAdStatuses,
  facebookAccessToken: string,
) => {
  try {
    const url = `${HOST}/${adId}?status=${status}&access_token=${facebookAccessToken}`;

    const response = await fetch(url, { method: 'POST' });

    if (!response.ok) {
      const { error } = (await response.json()) as ErrorResponse;
      throw new Error(
        `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
      );
    }

    const { data } = await response.json();

    return !!data?.success;
  } catch (error) {
    console.log(`Error occurred trying to update facebook ad: ${adId}`);
    throw error;
  }
};

export const getAllFacebookData = async (
  facebookAccessToken: string,
  facebookAdAccountId: string,
  type: string,
): Promise<FacebookReponse> => {
  try {
    const url = `${HOST}/${facebookAdAccountId}/${type}?fields=id,name,objective,account_id,effective_status&access_token=${facebookAccessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      const { error } = (await response.json()) as ErrorResponse;
      throw new Error(
        `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
      );
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.log(
      `Error occurred trying to get campaigns from facebook account. FB Account ID: ${facebookAdAccountId}`,
    );
    throw error;
  }
};

export const getFacebookInsight = async (
  facebookAccessToken: string,
  facebookAdAccountId: string,
  campaignIds: string[],
) => {
  try {
    const campaignURL = campaignIds.map((campaignId) => ({
      method: 'GET',
      relative_url: `${campaignId}/insights?fields=action_values,spend,campaign_name,purchase_roas,actions,cost_per_action_type&use_unified_attribution_setting=true&level=ad`,
    }));

    const formData = new FormData();
    formData.append('access_token', facebookAccessToken);
    formData.append('batch', JSON.stringify(campaignURL));

    const response = await fetch(HOST, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const { error } = (await response.json()) as ErrorResponse;
      throw new Error(
        `Http Status code=${response.status}, Error Code=${error.code}, Error Message=${error.message}`,
      );
    }

    const { data } = await response.json();

    return data;
  } catch (error) {
    console.log(
      `Error occurred trying to get insights from facebook account FB Account ID: ${facebookAdAccountId}`,
    );
    throw error;
  }
};

export const getFacebookAdsPixels = async (
  facebookAdAccountId: string,
  facebookAccessToken: string,
): Promise<Response> => {
  const url = `${HOST}/${facebookAdAccountId}/adspixels?fields=id,name&access_token=${facebookAccessToken}`;

  return fetch(url);
};
