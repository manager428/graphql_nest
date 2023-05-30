import { StatusCodeError } from './statusCodes';
import { ErrorResponse } from './types';
import { logError } from './utils';

/**
 * @param {unknown} error Error stack thrown
 * @param {Record<string, any>} event Event that was passed to the function
 * @returns
 */
export const errorResponse = (
  error: unknown,
  event: Record<string, any>,
): ErrorResponse => {
  const errorMessage =
    error instanceof StatusCodeError || error instanceof Error
      ? error?.message
      : 'Unknown Error';

  logError(event, errorMessage);

  return {
    error: {
      code: error instanceof StatusCodeError ? error.code : 184,
      message: errorMessage,
    },
  };
};
