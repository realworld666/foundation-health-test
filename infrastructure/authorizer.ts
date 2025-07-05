import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { Input } from '@pulumi/pulumi';
import { region, stageName } from './config';
import { createLambdaFunction } from './lambda';

export function createAuthorizerLambda(userPoolId: Input<string>, clientId: Input<string>) {
  // Create the Lambda role for the authorizer
  const authorizerRole = new aws.iam.Role(`${stageName}-custom-authorizer-role`, {
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Principal: {
            Service: 'lambda.amazonaws.com',
          },
          Effect: 'Allow',
        },
      ],
    },
  });

  // Attach basic Lambda execution policy
  new aws.iam.RolePolicyAttachment(`${stageName}-lambda-basic-execution`, {
    role: authorizerRole.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  });

  // Create the authorizer Lambda function
  return createLambdaFunction(
    'custom-authorizer',
    '../dist/authorizer/jwtAuth',
    'index.handler',
    {
      COGNITO_USER_POOL_ID: userPoolId,
      COGNITO_CLIENT_ID: clientId,
    },
    authorizerRole
  );
}

export function createAuthorizer(api: aws.apigateway.RestApi, authorizerFn: aws.lambda.Function) {
  const authorizer = new aws.apigateway.Authorizer('custom', {
    restApi: api.id,
    name: 'custom',
    type: 'TOKEN',
    authorizerResultTtlInSeconds: 300,
    authorizerUri: pulumi.interpolate`arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${authorizerFn.arn}/invocations`,
    identitySource: 'method.request.header.Authorization',
    identityValidationExpression: '^Bearer [-0-9a-zA-Z\\._]*$',
  });

  // Grant API Gateway permission to invoke the authorizer
  new aws.lambda.Permission('api-gateway-authorizer', {
    action: 'lambda:InvokeFunction',
    function: authorizerFn.name,
    principal: 'apigateway.amazonaws.com',
    sourceArn: pulumi.interpolate`${api.executionArn}/*`,
  });

  return authorizer;
}
