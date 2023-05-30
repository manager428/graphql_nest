import { Business, User } from '@sirge-io/sirge-types';
import { getAllFacebookData, getFacebookReports } from './facebook';
import {
  getAllTikTokAdGroups,
  getAllTikTokAds,
  getAllTikTokCampaigns,
  getTiktokInsights,
} from './tiktok';
import { FacebookReponse, TikTokBusinessCampignResponse } from './types';

/** FACEBOOK */

export const transformFacebookData = (response: FacebookReponse) => {
  const { data, paging } = response;
  const result = data.map((item: any) => item);

  return result;
};

export const getFacebookData = async (
  access_token: string,
  business: Business,
  date_from: string,
  date_end: string,
) => {
  try {
    const { facebook_ad_account_id } = business;

    const facebookData = [];

    // Get All Campaigns
    const campaignResponse = await getAllFacebookData(
      access_token as string,
      facebook_ad_account_id as string,
      'campaigns',
    );

    // Get All AdGroups
    const adGroupResponse = await getAllFacebookData(
      access_token as string,
      facebook_ad_account_id as string,
      'adsets',
    );

    // Get All Ads
    const AdResponse = await getAllFacebookData(
      access_token as string,
      facebook_ad_account_id as string,
      'ads',
    );

    let campaignResult = transformFacebookData(campaignResponse);
    let adGroupResult = transformFacebookData(adGroupResponse);
    let adResult = transformFacebookData(AdResponse);

    //Get Campaigns Report
    if (campaignResult) {
      campaignResult = campaignResult.map(async (campaign) => {
        if (campaign?.id) {
          const insights = await getFacebookReports(
            access_token,
            campaign?.id,
            date_from,
            date_end,
          );

          return { ...campaign, insights: insights?.data };
        }
      });
    }

    //Get AdGroup Report
    if (adGroupResult) {
      adGroupResult = adGroupResult.map(async (adgroup) => {
        if (adgroup?.id) {
          const insights = await getFacebookReports(
            access_token,
            adgroup?.id,
            date_from,
            date_end,
          );

          return { ...adgroup, insights: insights?.data };
        }
      });
    }

    //Get Ad Report
    if (adResult) {
      adResult = adResult.map(async (ad) => {
        if (ad?.id) {
          const insights = await getFacebookReports(
            access_token,
            ad?.id,
            date_from,
            date_end,
          );

          return { ...ad, insights: insights?.data };
        }
      });
    }

    facebookData.push({
      campaigns: campaignResult,
      adsets: adGroupResult,
      ads: adResult,
    });

    return facebookData;
  } catch (error) {
    throw error;
  }
};

/** TIK-TOK */
const transformTiktokData = (response: TikTokBusinessCampignResponse) => {
  const { code, message, data } = response;
  const { list, page_info } = data; // add logic to ensure call is remade whenever there is data on the next page.
  const result =
    code === 0 && message.toLowerCase() === 'ok' && list.map((item) => item);

  return result;
};

export const getTiktokData = async (
  access_token: string,
  business: Business,
  date_from: string,
  date_end: string,
) => {
  try {
    const { tik_tok_ad_account_id } = business;

    const tiktokData = [];

    // Get All Campaigns
    const campaignResponse = await getAllTikTokCampaigns(
      access_token as string,
      tik_tok_ad_account_id as string,
    );

    // Get All AdGroups
    const adGroupResponse = await getAllTikTokAdGroups(
      access_token as string,
      tik_tok_ad_account_id as string,
    );

    // Get All Ads
    const AdResponse = await getAllTikTokAds(
      access_token as string,
      tik_tok_ad_account_id as string,
    );

    let campaignResult = transformTiktokData(campaignResponse);
    let adGroupResult = transformTiktokData(adGroupResponse);
    let adResult = transformTiktokData(AdResponse);

    //Get Campaigns Report
    if (campaignResult) {
      campaignResult = campaignResult.map(async (campaign) => {
        if (campaign?.campaign_id) {
          const insights = await getTiktokInsights(
            access_token,
            tik_tok_ad_account_id as string,
            date_from,
            date_end,
            campaign?.campaign_id,
            'campaign_ids',
          );

          return { ...campaign, insights: insights?.list };
        }
      });
    }

    //Get AdGroup Report
    if (adGroupResult) {
      adGroupResult = adGroupResult.map(async (adgroup) => {
        if (adgroup?.adgroup_id) {
          const insights = await getTiktokInsights(
            access_token,
            tik_tok_ad_account_id as string,
            date_from,
            date_end,
            adgroup?.adgroup_id,
            'adgroup_ids',
          );

          return { ...adgroup, insights: insights?.list };
        }
      });
    }

    //Get Ad Report
    if (adResult) {
      adResult = adResult.map(async (ad) => {
        if (ad?.ad_id) {
          const insights = await getTiktokInsights(
            access_token,
            tik_tok_ad_account_id as string,
            date_from,
            date_end,
            ad?.ad_id,
            'ad_ids',
          );

          return { ...ad, insights: insights?.list };
        }
      });
    }

    tiktokData.push({
      campaigns: campaignResult,
      adsets: adGroupResult,
      ads: adResult,
    });

    return tiktokData;
  } catch (error) {
    throw error;
  }
};
