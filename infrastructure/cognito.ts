import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { stageName } from './config';

export function createCognitoUserPool(name: string, postConfirmationLambda: aws.lambda.Function) {
  // Get Google OAuth credentials from config
  const config = new pulumi.Config();
  const googleClientId = config.require('googleClientId');
  const googleClientSecret = config.requireSecret('googleClientSecret');

  // Create Cognito User Pool
  const userPool = new aws.cognito.UserPool(`${stageName}-${name}`, {
    usernameAttributes: ['email'],
    autoVerifiedAttributes: ['email'],
    accountRecoverySetting: {
      recoveryMechanisms: [
        {
          name: 'verified_email',
          priority: 1,
        },
      ],
    },
    passwordPolicy: {
      minimumLength: 8,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
      requireUppercase: false,
    },
    schemas: [
      {
        attributeDataType: 'String',
        name: 'email',
        required: true,
        mutable: true,
        stringAttributeConstraints: {
          minLength: '0',
          maxLength: '2048',
        },
      },
    ],
    lambdaConfig: {
      postConfirmation: postConfirmationLambda.arn,
    },
  });

  // Add Lambda permission for Cognito
  new aws.lambda.Permission(`${stageName}-postConfirmationPermission`, {
    action: 'lambda:InvokeFunction',
    function: postConfirmationLambda.name,
    principal: 'cognito-idp.amazonaws.com',
    sourceArn: userPool.arn,
  });

  // Create Identity Provider for Google
  const googleProvider = new aws.cognito.IdentityProvider('googleProvider', {
    userPoolId: userPool.id,
    providerName: 'Google',
    providerType: 'Google',
    providerDetails: {
      client_id: googleClientId,
      client_secret: googleClientSecret,
      authorize_scopes: 'email profile openid',
    },
    attributeMapping: {
      email: 'email',
      given_name: 'given_name',
      family_name: 'family_name',
    },
  });

  // Create User Pool Client
  const userPoolClient = new aws.cognito.UserPoolClient(
    `${stageName}-userPoolClient`,
    {
      userPoolId: userPool.id,
      generateSecret: false,
      explicitAuthFlows: [
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
      supportedIdentityProviders: ['COGNITO', 'Google'],
      allowedOauthFlowsUserPoolClient: true,
      allowedOauthFlows: ['code'],
      allowedOauthScopes: ['email', 'openid', 'profile'],
      callbackUrls: [
        'http://localhost:8081/',
        'jfg://callback',
        'https://master.d1673favy6fst1.amplifyapp.com/',
      ], // Replace with your app URLs
      logoutUrls: [
        'http://localhost:8081/',
        'jfg://callback',
        'https://master.d1673favy6fst1.amplifyapp.com/',
      ], // Replace with your app URLs
    },
    { dependsOn: [googleProvider] }
  );

  // Create Domain for hosted UI
  const domain = new aws.cognito.UserPoolDomain(`${stageName}-userPoolDomain`, {
    domain: `${stageName}-auth-domain`, // Must be unique across AWS
    userPoolId: userPool.id,
  });

  // Export the IDs as Pulumi outputs
  const outputs = {
    userPool,
    userPoolClient,
    userPoolId: userPool.id,
    userPoolClientId: userPoolClient.id,
  };

  return outputs;
}
