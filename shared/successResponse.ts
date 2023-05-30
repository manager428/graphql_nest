import { PerformanceSummary, SuccessResponse } from './types';

/**
 * @param {T | null} payload Data to be returned
 * @param {string} message A simple message returned
 * @returns
 */
export const successResponse = <T>(
  payload?: T | null,
  message?: string,
  numberPages?: number,
  // summary?: number,
): SuccessResponse<T> => {
  return {
    ...(payload && { data: payload }),
    ...(message && { message }),
    ...(numberPages && { numberPages }),
    // ...(summary && { summary }),
  };
};
