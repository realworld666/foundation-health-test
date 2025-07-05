import { buildResponse } from '../../utils/buildResponse';

export const handler = async () => {
  return Promise.resolve(buildResponse(200, JSON.stringify({})));
};
