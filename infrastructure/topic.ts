import * as aws from '@pulumi/aws';
import { createBasicLambdaRole, serviceName, stageName } from './config';

export const createTopicPolicyForLambda = (name: string, topic: aws.sns.Topic) => {
  return new aws.iam.Policy(`${stageName}-${name}TopicLambdaPolicy`, {
    description: 'Policy to allow Lambda to send messages to SNS',
    policy: topic.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['sns:Publish'],
            Resource: arn,
          },
        ],
      })
    ),
  });
};
export const addTopicPolicyToRole = (name: string, topic: aws.sns.Topic, role?: aws.iam.Role) => {
  let newRole = role || createBasicLambdaRole(name);

  // Create an inline policy instead of managed policy attachment
  const snsPolicy = new aws.iam.RolePolicy(`${stageName}-${name}SnsPolicy`, {
    role: newRole.id,
    policy: topic.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['sns:Publish'],
            Resource: arn,
          },
        ],
      })
    ),
  });
  return newRole;
};

export const createTopic = (name: string) => {
  const topic = new aws.sns.Topic(`${stageName}-${name}`, {
    name: `${serviceName}-${name}`,
  });

  return topic;
};
