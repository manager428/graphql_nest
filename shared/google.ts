import { VisitorAddressParam } from './types';
require('dotenv').config();

export const getGoogleInfo = async (
  visitor_address: VisitorAddressParam,
) => {
  try {
    const address = encodeURI(`${visitor_address.line1},${visitor_address.city}${visitor_address.province}${visitor_address.country}`);
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${address})&key=${process.env.GOOGLE_API_KEY}`
    );
    const { data } = await resp.json();
    return data;

  } catch (error) {
    console.log(`Error occurred trying to get the googleinfo `);
    throw error;
  }
};

