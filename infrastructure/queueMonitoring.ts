import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { createDLQAlarm } from './cloudwatch';
import { stageName } from './config';
import { createEventSourceMapping } from './queue';

/**
 * Extended version of createEventSourceMapping that also creates a CloudWatch alarm
 * for DLQ messages instead of error logs (more cost-effective monitoring)
 *
 * @param name The name of the event source mapping
 * @param lambda The Lambda function to trigger
 * @param queue The SQS queue to use as an event source
 * @param dlq The Dead Letter Queue associated with the main queue
 * @param batchSize The number of records to process in each batch
 * @param maximumBatchingWindowInSeconds The maximum amount of time to gather records before invoking the function
 * @param additionalConfig Additional configuration for the event source mapping
 * @param alarmActions Optional SNS topics or other actions to trigger when the alarm fires
 * @returns The created event source mapping
 */
export function createMonitoredEventSourceMapping(
  name: string,
  lambda: aws.lambda.Function,
  queue: aws.sqs.Queue,
  dlq: aws.sqs.Queue,
  batchSize: number = 10,
  maximumBatchingWindowInSeconds: number = 60,
  additionalConfig?: {
    functionResponseTypes?: string[];
    scalingConfig?: {
      maximumConcurrency?: number;
    };
  },
  alarmActions: pulumi.Input<string>[] = []
): aws.lambda.EventSourceMapping {
  // Create the CloudWatch alarm for DLQ messages instead of error logs
  if (stageName !== 'dev') {
    const alarm = createDLQAlarm(dlq, {
      name: `${name}-dlq`,
      description: `Alarm for messages in ${name} Dead Letter Queue`,
      alarmActions,
    });
  }

  // Create the event source mapping as usual
  return createEventSourceMapping(
    name,
    lambda,
    queue,
    batchSize,
    maximumBatchingWindowInSeconds,
    additionalConfig
  );
}

/**
 * Creates an SNS topic for CloudWatch alarms
 *
 * @param name The name of the SNS topic
 * @returns The created SNS topic
 */
export function createCloudWatchAlarmTopic(name: string): aws.sns.Topic {
  return new aws.sns.Topic(`${stageName}-${name}-alarm-topic`, {
    name: `${stageName}-${name}-alarm-topic`,
  });
}

/**
 * Subscribes an email address to a CloudWatch alarm SNS topic
 *
 * @param name The name of the subscription
 * @param topic The SNS topic to subscribe to
 * @param emailAddress The email address to notify
 * @returns The created SNS topic subscription
 */
export function subscribeEmailToAlarmTopic(
  name: string,
  topic: aws.sns.Topic,
  emailAddress: string
): aws.sns.TopicSubscription {
  return new aws.sns.TopicSubscription(`${stageName}-${name}-email-subscription`, {
    topic: topic.arn,
    protocol: 'email',
    endpoint: emailAddress,
  });
}
