import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import * as pulumi from '@pulumi/pulumi';
import * as crypto from 'crypto';

export const config = new pulumi.Config();
export const logLevel = config.get('logLevel') || 'INFO';
export const serviceName = 'fh-backend';
export const stageName = pulumi.getStack();
export const sqsBatchWindow = 60; // Default batch window for most queues
export const sqsBatchWindowMaximum = 300; // For anything we don't need in a hurry (5 minutes)
export const sqsBatchWindowMinimum = 0; // For anything we need to process as soon as possible

// Global environment variables store
const globalEnvVars: { [key: string]: pulumi.Input<string> } = {};

// Global queue permissions store
const globalQueuePermissions: Array<{
  name: string;
  queue: aws.sqs.Queue;
  permissions: 'send' | 'read' | 'both';
}> = [];

// Global DynamoDB permissions store
const globalDynamoPermissions: Array<{
  name: string;
  table: aws.dynamodb.Table;
  permissions: 'read' | 'write' | 'both';
}> = [];

/**
 * Set a global environment variable that will be available to all Lambda functions
 * @param key Environment variable name
 * @param value Environment variable value
 */
export const setGlobalEnvVar = (key: string, value: pulumi.Input<string>): void => {
  globalEnvVars[key] = value;
};

/**
 * Get all global environment variables
 * @returns Object containing all global environment variables
 */
export const getGlobalEnvVars = (): { [key: string]: pulumi.Input<string> } => {
  return { ...globalEnvVars };
};

/**
 * Add a global queue permission that will be available to all Lambda functions
 * @param name Unique name for this permission
 * @param queue The SQS queue
 * @param permissions Type of permissions ('send', 'read', or 'both')
 */
export const addGlobalQueuePermission = (
  name: string,
  queue: aws.sqs.Queue,
  permissions: 'send' | 'read' | 'both' = 'send'
): void => {
  globalQueuePermissions.push({ name, queue, permissions });
};

/**
 * Get all global queue permissions
 * @returns Array of global queue permissions
 */
export const getGlobalQueuePermissions = () => {
  return [...globalQueuePermissions];
};

/**
 * Add a global DynamoDB permission that will be available to all Lambda functions
 * @param name Unique name for this permission
 * @param table The DynamoDB table
 * @param permissions Type of permissions ('read', 'write', or 'both')
 */
export const addGlobalDynamoPermission = (
  name: string,
  table: aws.dynamodb.Table,
  permissions: 'read' | 'write' | 'both' = 'both'
): void => {
  globalDynamoPermissions.push({ name, table, permissions });
};

/**
 * Get all global DynamoDB permissions
 * @returns Array of global DynamoDB permissions
 */
export const getGlobalDynamoPermissions = () => {
  return [...globalDynamoPermissions];
};

export const sha1 = (data: string): string => {
  return crypto.createHash('sha1').update(data).digest('hex');
};

export const createBasicLambdaRole = (name: string) => {
  const lambdaRole = new aws.iam.Role(`${stageName}-${name}LambdaRole`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: 'lambda.amazonaws.com' }),
  });

  // Only attach the basic execution role as a managed policy
  new aws.iam.RolePolicyAttachment(`${name}LambdaRoleAttachment`, {
    role: lambdaRole,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
  });

  // Create a comprehensive inline policy for all other permissions
  const comprehensivePolicy = new aws.iam.RolePolicy(
    `${stageName}-${name}LambdaComprehensivePolicy`,
    {
      role: lambdaRole.id,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          // X-Ray permissions
          {
            Effect: 'Allow',
            Action: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords',
              'xray:GetSamplingRules',
              'xray:GetSamplingTargets',
              'xray:GetSamplingStatisticSummaries',
            ],
            Resource: '*',
          },
          // Lambda Insights permissions
          {
            Effect: 'Allow',
            Action: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:PutLogEvents',
              'logs:DescribeLogStreams',
              'logs:DescribeLogGroups',
            ],
            Resource: '*',
          },
        ],
      }),
    }
  );

  // Add global queue permissions to the comprehensive policy
  const globalQueuePerms = getGlobalQueuePermissions();
  if (globalQueuePerms.length > 0) {
    globalQueuePerms.forEach((permission, index) => {
      const actions: string[] = [];

      if (permission.permissions === 'send' || permission.permissions === 'both') {
        actions.push('sqs:SendMessage', 'sqs:SendMessageBatch');
      }

      if (permission.permissions === 'read' || permission.permissions === 'both') {
        actions.push(
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
          'sqs:ChangeMessageVisibility'
        );
      }

      if (actions.length > 0) {
        // Add to the comprehensive policy instead of creating separate policies
        const globalQueuePolicy = new aws.iam.RolePolicy(
          `${stageName}-${name}-global-${permission.name}-policy`,
          {
            role: lambdaRole.id,
            policy: permission.queue.arn.apply((arn) =>
              JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: actions,
                    Resource: arn,
                  },
                ],
              })
            ),
          }
        );
      }
    });
  }

  // Add global DynamoDB permissions to the comprehensive policy
  const globalDynamoPerms = getGlobalDynamoPermissions();
  if (globalDynamoPerms.length > 0) {
    globalDynamoPerms.forEach((permission, index) => {
      const actions: string[] = [];

      if (permission.permissions === 'read' || permission.permissions === 'both') {
        actions.push(
          'dynamodb:GetItem',
          'dynamodb:Query',
          'dynamodb:Scan',
          'dynamodb:BatchGetItem'
        );
      }

      if (permission.permissions === 'write' || permission.permissions === 'both') {
        actions.push(
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:BatchWriteItem'
        );
      }

      if (actions.length > 0) {
        // Add to the comprehensive policy instead of creating separate policies
        const globalDynamoPolicy = new aws.iam.RolePolicy(
          `${stageName}-${name}-global-dynamo-${permission.name}-policy`,
          {
            role: lambdaRole.id,
            policy: permission.table.arn.apply((arn) =>
              JSON.stringify({
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: actions,
                    Resource: [
                      arn, // Table ARN
                      `${arn}/index/*`, // Index ARNs
                    ],
                  },
                ],
              })
            ),
          }
        );
      }
    });
  }

  return lambdaRole;
};

export const getCommonLambdaSettings = (
  name: string,
  role?: Role,
  additionalEnvVars?: { [key: string]: pulumi.Input<string> }
): aws.lambda.FunctionArgs => {
  return {
    runtime: aws.lambda.Runtime.NodeJS20dX,
    role: (role ?? createBasicLambdaRole(name)).arn,
    environment: {
      variables: {
        SERVICE_NAME: serviceName,
        LOG_LEVEL: logLevel,
        TRACER_ENABLED: 'true',
        STAGE: stageName,
        REGION: region,
        // Include global environment variables first (can be overridden by function-specific variables)
        ...getGlobalEnvVars(),
        // Include function-specific environment variables (these take precedence)
        ...additionalEnvVars,
      },
    },
    memorySize: 256,
    timeout: 30,
    tracingConfig: {
      mode: 'Active',
    },
  };
};
export const region = 'us-east-2';
