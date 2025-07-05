import { createApiRoutes } from './api';
import { createLambdaFunction } from './lambda';

// Create HTTP Lambda Functions
// Create the ping Lambda with the SES role
const [pingLambda] = createLambdaFunction('ping', '../dist/functions/ping', 'index.handler');

// Create the MP3 analysis Lambda
const [mp3AnalyseLambda] = createLambdaFunction(
  'mp3-analyse',
  '../dist/functions/mp3',
  'index.handler'
);

const { api } = createApiRoutes({
  pingLambda,
  mp3AnalyseLambda,
});
// Export the URL of the API
export const url = api.stage.invokeUrl;
