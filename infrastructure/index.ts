import * as aws from '@pulumi/aws';
import { createApiRoutes } from './api';
import { createLambdaFunction } from './lambda';
import { addBucketReadPolicyToRole, createBucket } from './s3';

// Create HTTP Lambda Functions
// Create the ping Lambda with the SES role
const [pingLambda] = createLambdaFunction('ping', '../dist/functions/ping', 'index.handler');


const { api } = createApiRoutes({
  pingLambda,
});
// Export the URL of the API
export const url = api.stage.invokeUrl;
