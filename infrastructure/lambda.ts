import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import * as pulumi from '@pulumi/pulumi';
import { Input } from '@pulumi/pulumi';
import { createBasicLambdaRole, getCommonLambdaSettings, stageName } from './config';

interface ExtraAsset {
  source: string; // Source path on local filesystem
  destination: string; // Destination path in Lambda
}

export const addLambdaInvokePolicyToRole = (
  name: string,
  targetLambdas: aws.lambda.Function[],
  role?: Role
): Role => {
  let newRole = role || createBasicLambdaRole(name);

  targetLambdas.forEach((lambda, index) => {
    // Create an inline policy for Lambda invocation instead of managed policy
    const invokePolicy = new aws.iam.RolePolicy(`${stageName}-${name}LambdaInvokePolicy${index}`, {
      role: newRole.id,
      policy: lambda.arn.apply((arn) =>
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: ['lambda:InvokeFunction'],
              Resource: arn,
            },
          ],
        })
      ),
    });
  });

  return newRole;
};

export const createLambdaFunction = (
  name: string,
  path: string,
  handler: string,
  environment?: { [key: string]: Input<string> },
  role?: Role,
  extraAssets?: ExtraAsset[],
  config?: {
    memorySize?: number;
    timeout?: number;
    logRetentionInDays?: number;
  }
): [aws.lambda.Function, aws.cloudwatch.LogGroup] => {
  const commonLambdaSettings = getCommonLambdaSettings(name, role);

  const assets: { [key: string]: pulumi.asset.Asset } = {
    '.': new pulumi.asset.FileArchive(path),
  };

  // Add any extra assets if provided
  extraAssets?.forEach((asset) => {
    assets[asset.destination] = new pulumi.asset.FileAsset(asset.source);
  });

  // Create the Lambda first to get its name
  const lambda = new aws.lambda.Function(`${stageName}-${name}`, {
    ...commonLambdaSettings,
    memorySize: config?.memorySize ?? commonLambdaSettings.memorySize,
    timeout: config?.timeout ?? commonLambdaSettings.timeout,
    code: new pulumi.asset.AssetArchive(assets),
    handler: handler,
    environment: {
      variables: {
        // @ts-ignore
        ...commonLambdaSettings.environment!.variables,
        ...environment,
      },
    },
  });

  // Create CloudWatch log group with the exact Lambda name
  const logGroupName = lambda.name.apply((name) => `/aws/lambda/${name}`);
  const logGroup = new aws.cloudwatch.LogGroup(`${stageName}-${name}-log-group`, {
    name: logGroupName,
    retentionInDays: config?.logRetentionInDays ?? 14,
  });

  return [lambda, logGroup];
};
