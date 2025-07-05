import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import * as pulumi from '@pulumi/pulumi';
import { createBasicLambdaRole, stageName } from './config';

export const createDLQ = (name: string) => {
  return new aws.sqs.Queue(`${stageName}-${name}-dlq`, {
    visibilityTimeoutSeconds: 300,
    messageRetentionSeconds: 604800, // 7 days
    receiveWaitTimeSeconds: 20,
  });
};

export const createQueue = (
  name: string,
  dlq: aws.sqs.Queue,
  maxReceiveCount: number = 3,
  config?: {
    visibilityTimeout?: number;
    messageRetentionSeconds?: number;
    receiveWaitTimeSeconds?: number;
  }
) => {
  return new aws.sqs.Queue(`${stageName}-${name}`, {
    visibilityTimeoutSeconds: config?.visibilityTimeout || 60,
    messageRetentionSeconds: config?.messageRetentionSeconds || 86400, // 1 day
    receiveWaitTimeSeconds: config?.receiveWaitTimeSeconds || 20,
    redrivePolicy: dlq.arn.apply((arn) =>
      JSON.stringify({
        deadLetterTargetArn: arn,
        maxReceiveCount: maxReceiveCount,
      })
    ),
  });
};

export const createQueuePolicy = (
  name: string,
  queue: aws.sqs.Queue,
  topicArn: pulumi.Output<string>
) => {
  return new aws.sqs.QueuePolicy(`${stageName}-${name}Policy`, {
    queueUrl: queue.url,
    policy: pulumi.all([queue.arn, topicArn]).apply(([queueArn, resolvedTopicArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'sns.amazonaws.com' },
            Action: 'SQS:SendMessage',
            Resource: queueArn,
            Condition: {
              ArnEquals: {
                'aws:SourceArn': resolvedTopicArn,
              },
            },
          },
        ],
      })
    ),
  });
};

export const subscribeQueueToTopic = (
  name: string,
  queue: aws.sqs.Queue,
  topic: aws.sns.Topic,
  filterPolicy?: string | object
) => {
  // if filterPolicy is an object convert it to a string
  if (typeof filterPolicy === 'object') {
    filterPolicy = JSON.stringify(filterPolicy);
  }

  const params = {
    topic: topic.arn,
    protocol: 'sqs',
    endpoint: queue.arn,
    rawMessageDelivery: true,
    ...(filterPolicy && { filterPolicy }),
  };
  return new aws.sns.TopicSubscription(`${stageName}-${name}Subscription`, params);
};

/**
 * Add permission for a lambda to be triggered by a queue
 * @param name
 * @param lambda
 * @param queue
 */
export const addLambdaPermissionForSQS = (
  name: string,
  lambda: aws.lambda.Function,
  queue: aws.sqs.Queue
) => {
  return new aws.lambda.Permission(`${stageName}-${name}SQSPermission`, {
    action: 'lambda:InvokeFunction',
    function: lambda.name,
    principal: 'sqs.amazonaws.com',
    sourceArn: queue.arn,
  });
};

export const createEventSourceMapping = (
  name: string,
  lambda: aws.lambda.Function,
  queue: aws.sqs.Queue,
  batchSize: number = 10,
  maximumBatchingWindowInSeconds: number = 60,
  additionalConfig?: {
    functionResponseTypes?: string[];
    scalingConfig?: {
      maximumConcurrency?: number;
    };
  }
) => {
  return new aws.lambda.EventSourceMapping(
    `${stageName}-${name}EventSourceMapping`,
    {
      eventSourceArn: queue.arn,
      functionName: lambda.name,
      batchSize: batchSize,
      maximumBatchingWindowInSeconds: maximumBatchingWindowInSeconds,
      enabled: true,
      ...additionalConfig,
    },
    { dependsOn: [queue, lambda] }
  );
};

// Create a custom policy for SQS access
export const createQueuePolicyForLambda = (name: string, queue: aws.sqs.Queue) => {
  return new aws.iam.Policy(`${stageName}-${name}QueueLambdaPolicy`, {
    description: 'Policy to allow Lambda to receive messages from SQS',
    policy: queue.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'sqs:ReceiveMessage',
              'sqs:DeleteMessage',
              'sqs:GetQueueAttributes',
              'sqs:ChangeMessageVisibility',
            ],
            Resource: arn,
          },
        ],
      })
    ),
  });
};

/**
 * Add permission for a lambda to read from a queue
 * @param name
 * @param queue
 * @param role
 */
export const addQueueReadPolicyToRole = (
  name: string,
  queue: aws.sqs.Queue,
  role?: aws.iam.Role
): Role => {
  let newRole = role || createBasicLambdaRole(name);

  // Create an inline policy instead of managed policy attachment
  const sqsPolicy = new aws.iam.RolePolicy(`${stageName}-${name}SqsPolicy`, {
    role: newRole.id,
    policy: queue.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'sqs:ReceiveMessage',
              'sqs:DeleteMessage',
              'sqs:GetQueueAttributes',
              'sqs:ChangeMessageVisibility',
            ],
            Resource: arn,
          },
        ],
      })
    ),
  });
  return newRole;
};

export const createQueueSendPolicyForLambda = (name: string, queue: aws.sqs.Queue) => {
  return new aws.iam.Policy(`${stageName}-${name}QueueSendLambdaPolicy`, {
    description: 'Policy to allow Lambda to send messages to SQS',
    policy: queue.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
            Resource: arn,
          },
        ],
      })
    ),
  });
};

export const addQueueSendPolicyToRole = (
  name: string,
  queue: aws.sqs.Queue,
  role?: aws.iam.Role
): Role => {
  let newRole = role || createBasicLambdaRole(name);

  // Create an inline policy instead of managed policy attachment
  const sqsSendPolicy = new aws.iam.RolePolicy(`${stageName}-${name}SqsSendPolicy`, {
    role: newRole.id,
    policy: queue.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
            Resource: arn,
          },
        ],
      })
    ),
  });
  return newRole;
};
