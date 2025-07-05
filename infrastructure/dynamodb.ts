import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import { createBasicLambdaRole, stageName } from './config';

export const createDynamoDbTable = (name: string, config: aws.dynamodb.TableArgs) => {
  return new aws.dynamodb.Table(`${stageName}-${name}`, {
    ...config,
  });
};

export const addDynamoPolicyToRole = (
  name: string,
  tables: aws.dynamodb.Table[],
  allowedActions: string[],
  role?: Role
) => {
  let newRole = role || createBasicLambdaRole(name);

  tables.forEach((table, index) => {
    // Create an inline policy for DynamoDB access instead of managed policy
    const dynamoPolicy = new aws.iam.RolePolicy(`${stageName}-${name}DynamoPolicy${index}`, {
      role: newRole.id,
      policy: table.arn.apply((arn) =>
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Action: allowedActions,
              Resource: [
                arn, // Table ARN
                `${arn}/index/*`, // Index ARNs
              ],
            },
          ],
        })
      ),
    });
  });

  return newRole;
};
