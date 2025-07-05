import { Function } from '@pulumi/aws/lambda';
import { createRESTAPI } from './apiGateway';

export function createApiRoutes(resources: { pingLambda: Function; mp3AnalyseLambda: Function }) {
  const api = createRESTAPI([
    {
      path: '/ping',
      method: 'GET',
      eventHandler: resources.pingLambda,
    },
    {
      path: '/mp3',
      method: 'GET',
      eventHandler: resources.mp3AnalyseLambda,
    },
  ]);

  return {
    api,
  };
}
