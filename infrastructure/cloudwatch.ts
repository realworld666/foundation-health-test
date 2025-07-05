import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { stageName } from './config';

/**
 * Interface for CloudWatch Alarm configuration
 */
export interface CloudWatchAlarmArgs {
  name: string;
  description?: string;
  threshold?: number;
  evaluationPeriods?: number;
  period?: number;
  comparisonOperator?: string;
  treatMissingData?: string;
  alarmActions?: pulumi.Input<string>[];
}

/**
 * Creates a CloudWatch Alarm for Lambda error logs
 * This alarm triggers when logs containing '"level": "ERROR"' are detected
 *
 * @param lambda The Lambda function to monitor
 * @param args Configuration for the CloudWatch Alarm
 * @param logGroup Optional CloudWatch Log Group to use for the metric filter. If not provided, one will be created
 * @returns A Pulumi Output containing the created CloudWatch Alarm
 */
export function createLambdaErrorLogAlarm(
  lambda: aws.lambda.Function,
  args: CloudWatchAlarmArgs,
  logGroup?: aws.cloudwatch.LogGroup
): pulumi.Output<aws.cloudwatch.MetricAlarm> {
  const {
    name,
    description = 'Alarm for error logs in Lambda function',
    threshold = 1,
    evaluationPeriods = 1,
    period = 300, // 5 minutes
    comparisonOperator = 'GreaterThanOrEqualToThreshold',
    treatMissingData = 'notBreaching',
    alarmActions = [],
  } = args;

  // Get the Lambda function name
  const lambdaName = lambda.name.apply((name) => name);

  // Create a metric filter directly on the log group that Lambda creates
  const metricFilterName = `${stageName}-${name}-error-log-filter`;
  const metricName = `${stageName}-${name}-error-logs`;

  // Create a CloudWatch Logs Metric Filter to detect error logs
  const metricFilter = lambdaName.apply((name) => {
    if (!logGroup) {
      const logGroupName = `/aws/lambda/${name}`;

      // Get or create the log group
      logGroup = new aws.cloudwatch.LogGroup(
        logGroupName,
        {
          name: logGroupName,
        },
        {
          protect: true, // Prevent deletion of existing log groups
          import: logGroupName, // Import if exists
          retainOnDelete: true, // Keep the log group when this resource is deleted
        }
      );
    }

    return new aws.cloudwatch.LogMetricFilter(
      metricFilterName,
      {
        logGroupName: logGroup.name,
        pattern: '{ ($.level = "ERROR") }',
        metricTransformation: {
          name: metricName,
          namespace: 'CustomLambdaMetrics',
          value: '1',
          defaultValue: '0',
        },
      },
      {
        dependsOn: [logGroup],
      }
    );
  });

  // Create a CloudWatch Alarm based on the metric filter
  return metricFilter.apply((filter) => {
    return new aws.cloudwatch.MetricAlarm(`${stageName}-${name}-error-log-alarm`, {
      alarmDescription: description,
      metricName: metricName,
      namespace: 'CustomLambdaMetrics',
      statistic: 'Sum',
      period,
      evaluationPeriods,
      threshold,
      comparisonOperator,
      treatMissingData,
      alarmActions,
    });
  });
}

/**
 * Creates a CloudWatch Alarm for SQS Lambda error logs
 * This is a specialized function for Lambda functions triggered by SQS queues
 *
 * @param name The name of the Lambda function
 * @param lambda The Lambda function to monitor
 * @param logGroup
 * @param alarmActions Optional SNS topics or other actions to trigger when the alarm fires
 * @returns A Pulumi Output containing the created CloudWatch Alarm
 */
export function createSQSLambdaErrorLogAlarm(
  name: string,
  lambda: aws.lambda.Function,
  logGroup?: aws.cloudwatch.LogGroup,
  alarmActions: pulumi.Input<string>[] = []
): pulumi.Output<aws.cloudwatch.MetricAlarm> {
  return createLambdaErrorLogAlarm(
    lambda,
    {
      name,
      description: `Alarm for error logs in SQS-triggered Lambda function ${name}`,
      alarmActions,
    },
    logGroup
  );
}

/**
 * Creates a CloudWatch Log Group with a 14-day retention period
 *
 * @param name The name of the log group
 * @returns The created CloudWatch Log Group
 */
export function createLogGroupWithRetention(
  name: string,
  period: number = 14
): aws.cloudwatch.LogGroup {
  return new aws.cloudwatch.LogGroup(name, {
    name,
    retentionInDays: period,
  });
}

/**
 * Creates a CloudWatch Alarm for SQS Dead Letter Queue message count
 * This alarm triggers when messages are present in a DLQ, indicating processing failures
 *
 * @param dlq The Dead Letter Queue to monitor
 * @param args Configuration for the CloudWatch Alarm
 * @returns The created CloudWatch Alarm
 */
export function createDLQAlarm(
  dlq: aws.sqs.Queue,
  args: CloudWatchAlarmArgs
): aws.cloudwatch.MetricAlarm {
  const {
    name,
    description = 'Alarm for messages in Dead Letter Queue',
    threshold = 1,
    evaluationPeriods = 1,
    period = 300, // 5 minutes
    comparisonOperator = 'GreaterThanOrEqualToThreshold',
    treatMissingData = 'notBreaching',
    alarmActions = [],
  } = args;

  return new aws.cloudwatch.MetricAlarm(`${stageName}-${name}-dlq-alarm`, {
    alarmDescription: description,
    metricName: 'ApproximateNumberOfMessagesVisible',
    namespace: 'AWS/SQS',
    statistic: 'Maximum',
    period,
    evaluationPeriods,
    threshold,
    comparisonOperator,
    treatMissingData,
    alarmActions,
    dimensions: {
      QueueName: dlq.name,
    },
  });
}
