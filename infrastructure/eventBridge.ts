import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { stageName } from './config';

interface EventBridgeRuleArgs {
  name: string;
  description?: string;
  scheduleExpression: string;
  lambda: aws.lambda.Function;
}

/**
 * Creates an EventBridge rule that triggers a Lambda function on a schedule
 * @param args Configuration for the EventBridge rule
 * @returns The created EventBridge rule
 */
export function createScheduledRule(args: EventBridgeRuleArgs): aws.cloudwatch.EventRule {
  const { name, description, scheduleExpression, lambda } = args;

  // Create the EventBridge rule
  const rule = new aws.cloudwatch.EventRule(`${stageName}-${name}`, {
    description,
    scheduleExpression,
  });

  // Allow EventBridge to invoke the lambda
  new aws.lambda.Permission(`${stageName}-${name}-permission`, {
    action: 'lambda:InvokeFunction',
    function: lambda.name,
    principal: 'events.amazonaws.com',
    sourceArn: rule.arn,
  });

  // Add the lambda as a target for the EventBridge rule
  new aws.cloudwatch.EventTarget(`${stageName}-${name}-target`, {
    rule: rule.name,
    arn: lambda.arn,
    targetId: name,
  });

  return rule;
}

interface EventBridgePatternRuleArgs {
  name: string;
  description?: string;
  eventPattern: {
    source?: string[];
    detailType?: string[];
    [key: string]: unknown;
  };
  lambda: aws.lambda.Function;
}

/**
 * Creates an EventBridge rule that triggers a Lambda function based on an event pattern
 * @param args Configuration for the EventBridge rule
 * @returns The created EventBridge rule
 */
export function createPatternRule(args: EventBridgePatternRuleArgs): aws.cloudwatch.EventRule {
  const { name, description, eventPattern, lambda } = args;

  // Create the EventBridge rule
  const rule = new aws.cloudwatch.EventRule(`${stageName}-${name}`, {
    description,
    eventPattern: pulumi.jsonStringify(eventPattern),
  });

  // Allow EventBridge to invoke the lambda
  new aws.lambda.Permission(`${stageName}-${name}-permission`, {
    action: 'lambda:InvokeFunction',
    function: lambda.name,
    principal: 'events.amazonaws.com',
    sourceArn: rule.arn,
  });

  // Add the lambda as a target for the EventBridge rule
  new aws.cloudwatch.EventTarget(`${stageName}-${name}-target`, {
    rule: rule.name,
    arn: lambda.arn,
    targetId: name,
  });

  return rule;
}

interface EventBridgeCustomBusArgs {
  name: string;
  description?: string;
}

/**
 * Creates a custom Event Bus
 * @param args Configuration for the custom Event Bus
 * @returns The created Event Bus
 */
export function createCustomBus(args: EventBridgeCustomBusArgs): aws.cloudwatch.EventBus {
  const { name, description } = args;

  return new aws.cloudwatch.EventBus(`${stageName}-${name}`, {
    name: `${stageName}-${name}`,
    description,
  });
}