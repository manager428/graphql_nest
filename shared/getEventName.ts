import { camelCase } from './camelCase';

export const getEventName = (handlerFile: string) =>
  camelCase(handlerFile.replace('.ts', ''));
