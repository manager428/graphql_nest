import { ReportsTikTok } from '@sirge-io/sirge-utils';
import {
  TikTokBusinessAdGroupResponse,
  TikTokBusinessCampignResponse,
} from './types';

require('dotenv').config();

const baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';

export const getTikTokAccessToken = async (auth_code: string) => {
  try {
    const response = await fetch(`${baseUrl}/oauth2/access_token/`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: process.env.TIKTOK_APP_ID,
        auth_code,
        secret: process.env.TIKTOK_APP_SECRET,
      }),
    });

    const { data, message } = await response.json();

    if (message === 'OK') {
      return data.access_token;
    }

    throw new Error(message);
  } catch (error) {
    console.log(`Error occurred trying to get tik tok access token `, error);
    throw error;
  }
};

export const getUserTikTokAds = async (access_token: string) => {
  try {
    const resp = await fetch(
      `${baseUrl}/oauth2/advertiser/get/?secret=${process.env.TIKTOK_APP_SECRET}&app_id=${process.env.TIKTOK_APP_ID}`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Token': access_token,
        },
      },
    );

    const { data } = await resp.json();

    return data?.list;
  } catch (error) {
    console.log(`Error occurred trying to connect user account to tik tok `);
    throw error;
  }
};

export const getCampaingsTikTok = async (
  access_token: string,
  tik_tok_ad_account_id: string,
  sirge_campaign_id: string,
) => {
  try {
    const headers = {
      'Access-Token': access_token,
    };

    const resp = await fetch(
      `${baseUrl}/campaign/get/?advertiser_id=${tik_tok_ad_account_id}&fields=["advertiser_id","operation_status"]&filtering={"campaign_ids: [${sirge_campaign_id}]`,
      {
        headers,
      },
    );

    const { data } = await resp.json();

    return data.list;
  } catch (error) {
    console.log(`Error occurred trying to get the Campaigns `);
    throw error;
  }
};

export const getReportsTikTok = async (
  access_token: string,
  tik_tok_ad_account_id: string,
  sirge_campaign_id: string,
  tik_tok_date_from: string,
  tik_tok_date_to: string,
): Promise<ReportsTikTok[]> => {
  try {
    const headers = {
      'Access-Token': access_token,
    };

    const resp = await fetch(
      `${baseUrl}/reports/integrated/get/?advertiser_id=${tik_tok_ad_account_id}&report_type=BASIC&data_level=AUCTION_AD
      &dimensions=["ad_id"]&filters=[{"field_name":"campaign_ids","filter_type":"IN","filter_value":"[${sirge_campaign_id}]}]
      &metrics=["spend","clicks","conversion","cost_per_conversion","complete_payment_roas","total_complete_payment_rate"]&start_date=${tik_tok_date_from}
      &end_date=${tik_tok_date_to}"`,
      {
        headers,
      },
    );

    const { data } = await resp.json();

    return data.list;
  } catch (error) {
    console.log(`Error occurred trying to get the reports `);
    throw error;
  }
};

export const getTiktokAdGroup = async (
  tik_tok_access_token: string,
  tik_tok_ad_account_id: string,
  sirge_adset_id: string,
): Promise<TikTokBusinessAdGroupResponse> => {
  try {
    const headers = {
      'Access-Token': tik_tok_access_token,
    };
    const url = `https://business-api.tiktok.com/open_api/v1.3/adgroup/get/?advertiser_id=${tik_tok_ad_account_id}
    &fields=["advertiser_id","operation_status"]&filtering={"adgroup_ids": ["${sirge_adset_id}"]}&page=1&page_size=1000`;

    const effective_status_data: Promise<TikTokBusinessAdGroupResponse> =
      await fetch(url, { headers })
        .then((response) => response.json())
        .then((res) => res.data);

    return effective_status_data;
  } catch (error) {
    console.log(`Error occurred trying to get ad groups`);
    throw error;
  }
};

export const getTiktokInsights = async (
  tik_tok_access_token: string,
  tik_tok_ad_account_id: string,
  tik_tok_date_from: string,
  tik_tok_date_to: string,
  sirge_ad: string | string[],
  type: string,
): Promise<TikTokBusinessAdGroupResponse> => {
  try {
    const headers = {
      'Access-Token': tik_tok_access_token,
    };
    const url = `https://business-api.tiktok.com/open_api/v1.2/reports/integrated/get/?advertiser_id=${tik_tok_ad_account_id}
    &report_type=BASIC&data_level=AUCTION_AD&dimensions=["ad_id"]&filters=[{"field_name":"${type}","filter_type":"IN","filter_value":"[${sirge_ad}]"}]
    &metrics=["spend","clicks","conversion","cost_per_conversion","complete_payment_roas","total_complete_payment_rate"]
    &start_date=${tik_tok_date_from}&end_date=${tik_tok_date_to}&page_size=1000`;

    const insights_data: Promise<TikTokBusinessAdGroupResponse> = await fetch(
      url,
      { headers },
    )
      .then((response) => response.json())
      .then((res) => res.data);

    return insights_data;
  } catch (error) {
    console.log(`Error occurred trying to get nsights`);
    throw error;
  }
};

export const getTiktokAd = async (
  tik_tok_access_token: string,
  tik_tok_ad_account_id: string,
  ad_ids: string[],
) => {
  try {
    const headers = {
      'Access-Token': tik_tok_access_token,
    };
    const url = `https://business-api.tiktok.com/open_api/v1.3/ad/get/?advertiser_id=${tik_tok_ad_account_id}
  &fields=["advertiser_id","operation_status"]&filtering={"ad_ids": ${JSON.stringify(
    ad_ids,
  )}}&page=1&page_size=1000`;

    const effective_status_arr_batch = await fetch(url, {
      headers,
    })
      .then((response) => response.json())
      .then((res) => res.data);

    return effective_status_arr_batch;
  } catch (error) {
    console.log(`Error occurred trying to get ad`);
    throw error;
  }
};

// newly added
export const getAllTikTokCampaigns = async (
  access_token: string,
  tik_tok_ad_account_id: string,
): Promise<TikTokBusinessCampignResponse> => {
  try {
    const headers = {
      'Access-Token': access_token,
    };

    const url = `${baseUrl}/campaign/get/?advertiser_id=${tik_tok_ad_account_id}&page_size=1000`;

    const resp = await fetch(url, {
      headers,
    });

    const response = await resp.json();

    return response;
  } catch (error) {
    console.log(`Error occurred trying to get Tiktok Campaigns`);
    throw error;
  }
};

export const getAllTikTokAds = async (
  tik_tok_access_token: string,
  tik_tok_ad_account_id: string,
): Promise<TikTokBusinessCampignResponse> => {
  try {
    const headers = {
      'Access-Token': tik_tok_access_token,
    };
    const url = `${baseUrl}/ad/get/?advertiser_id=${tik_tok_ad_account_id}&page_size=1000`;

    const resp = await fetch(url, {
      headers,
    });

    const response = await resp.json();

    return response;
  } catch (error) {
    console.log(`Error occurred trying to get tiktok Ads`);
    throw error;
  }
};

export const getTiktokAdInfo = async (
  tik_tok_access_token: string,
  tik_tok_ad_account_id: string,
) => {
  try {
    const headers = {
      'Access-Token': tik_tok_access_token,
    };

    const advertiser_ids = [tik_tok_ad_account_id];

    const url = `https://business-api.tiktok.com/open_api/v1.3/advertiser/info?advertiser_ids=${JSON.stringify(
      advertiser_ids,
    )}&fields=["name","timezone","currency"]`;

    const resp = await fetch(url, {
      headers,
    });
    const data = await resp.json();
    return data;
  } catch (error) {
    console.log(`Error occurred trying to get Tiktok Campaigns`);
    throw error;
  }
};

export const getAllTikTokAdGroups = async (
  tik_tok_access_token: string,
  tik_tok_ad_account_id: string,
): Promise<TikTokBusinessCampignResponse> => {
  try {
    const headers = {
      'Access-Token': tik_tok_access_token,
    };
    const url = `${baseUrl}/adgroup/get/?advertiser_id=${tik_tok_ad_account_id}&page_size=1000`;

    const resp = await fetch(url, {
      headers,
    });

    const response = await resp.json();

    return response;
  } catch (error) {
    console.log(`Error occurred trying to get tiktok Ad Groups`);
    throw error;
  }
};
