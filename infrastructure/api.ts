import { Function } from '@pulumi/aws/lambda';
import { createRESTAPI } from './apiGateway';

export function createApiRoutes(resources: { pingLambda: Function; mp3AnalyseLambda: Function }) {
  const api = createRESTAPI([
  ]);

  return {
    api,
  };
}
