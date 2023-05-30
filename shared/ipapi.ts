import { VisitorAddressParam } from './types';
require('dotenv').config();

export const getIpInfo = async (
  ip: string,
) => {
  try {
    const resp = await fetch(
      `https://ipapi.co/${ip}/json?key=${process.env.IP_API_CO_KEY}`
    );
    const { data } = await resp.json();
    return data;

  } catch (error) {
    console.log(`Error occurred trying to get the ipinfo `);
    throw error;
  }
};

