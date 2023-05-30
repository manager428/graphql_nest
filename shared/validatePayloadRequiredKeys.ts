export const validatePayloadRequiredKeys = (
  requiredKeys: string[],
  payload: any,
) => {
  const missingKeys: string[] = [];

  for (const requiredKey of requiredKeys) {
    if (!(requiredKey in payload)) {
      missingKeys.push(requiredKey);
    }
  }

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required keys in payload: ${missingKeys.join(',')}`,
    );
  }
};
