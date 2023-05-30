import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { AttributeMap } from 'aws-sdk/clients/dynamodb';

/**
 * @deprecated Moved to utils-be
 */
export const unmarshaller = <T>(dynamoData: AttributeMap) =>
  unmarshall(dynamoData as Record<string, AttributeValue>) as T;
