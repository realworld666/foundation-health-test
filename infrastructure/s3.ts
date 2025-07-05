import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import * as pulumi from '@pulumi/pulumi';
import { createBasicLambdaRole, stageName } from './config';

/**
 * Create an S3 bucket with standard configuration
 * @param name - The name of the bucket (will be prefixed with stage name)
 * @param config - Optional configuration for the bucket
 */
export const createBucket = (
  name: string,
  config?: {
    versioning?: boolean;
    publicRead?: boolean;
    publicWrite?: boolean;
    cors?: aws.s3.BucketCorsConfigurationV2Args;
    lifecycle?: aws.s3.BucketLifecycleConfigurationV2Args;
    encryption?: boolean;
  }
) => {
  const bucketName = `${stageName}-${name}`;

  const bucket = new aws.s3.BucketV2(bucketName, {
    bucket: bucketName,
    forceDestroy: true, // Allow deletion even if not empty (useful for dev/test)
  });

  // Configure versioning if requested
  if (config?.versioning) {
    new aws.s3.BucketVersioningV2(`${bucketName}-versioning`, {
      bucket: bucket.id,
      versioningConfiguration: {
        status: 'Enabled',
      },
    });
  }

  // Configure encryption (enabled by default)
  if (config?.encryption !== false) {
    new aws.s3.BucketServerSideEncryptionConfigurationV2(`${bucketName}-encryption`, {
      bucket: bucket.id,
      rules: [
        {
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: 'AES256',
          },
          bucketKeyEnabled: true,
        },
      ],
    });
  }

  // Configure public access block (default to private)
  new aws.s3.BucketPublicAccessBlock(`${bucketName}-public-access-block`, {
    bucket: bucket.id,
    blockPublicAcls: !config?.publicWrite,
    blockPublicPolicy: !config?.publicRead && !config?.publicWrite,
    ignorePublicAcls: !config?.publicWrite,
    restrictPublicBuckets: !config?.publicRead && !config?.publicWrite,
  });

  // Configure CORS if provided
  if (config?.cors) {
    new aws.s3.BucketCorsConfigurationV2(`${bucketName}-cors`, config.cors);
  }

  // Configure lifecycle if provided
  if (config?.lifecycle) {
    new aws.s3.BucketLifecycleConfigurationV2(`${bucketName}-lifecycle`, config.lifecycle);
  }

  return bucket;
};

/**
 * Create a bucket policy for external access
 * @param name - The name for the policy
 * @param bucket - The S3 bucket
 * @param policy - The policy document
 */
export const createBucketPolicy = (
  name: string,
  bucket: aws.s3.BucketV2,
  policy: pulumi.Input<string>
) => {
  return new aws.s3.BucketPolicy(`${stageName}-${name}Policy`, {
    bucket: bucket.id,
    policy: policy,
  });
};

/**
 * Create a public read policy for a bucket
 * @param name - The name for the policy
 * @param bucket - The S3 bucket
 */
export const createPublicReadPolicy = (name: string, bucket: aws.s3.BucketV2) => {
  return createBucketPolicy(
    name,
    bucket,
    bucket.arn.apply((arn) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `${arn}/*`,
          },
        ],
      })
    )
  );
};

/**
 * Create an IAM policy for S3 read access
 * @param name - The name for the policy
 * @param bucket - The S3 bucket
 * @param prefix - Optional prefix to restrict access to specific paths
 */
export const createBucketReadPolicyForLambda = (
  name: string,
  bucket: aws.s3.BucketV2,
  prefix?: string
) => {
  const resourceArn = prefix
    ? bucket.arn.apply((arn) => `${arn}/${prefix}/*`)
    : bucket.arn.apply((arn) => `${arn}/*`);

  return new aws.iam.Policy(`${stageName}-${name}BucketReadLambdaPolicy`, {
    description: 'Policy to allow Lambda to read from S3 bucket',
    policy: pulumi.all([bucket.arn, resourceArn]).apply(([bucketArn, objArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:GetObject', 's3:GetObjectVersion', 's3:GetObjectAttributes'],
            Resource: objArn,
          },
          {
            Effect: 'Allow',
            Action: ['s3:ListBucket', 's3:GetBucketLocation'],
            Resource: bucketArn,
          },
        ],
      })
    ),
  });
};

/**
 * Create an IAM policy for S3 write access
 * @param name - The name for the policy
 * @param bucket - The S3 bucket
 * @param prefix - Optional prefix to restrict access to specific paths
 */
export const createBucketWritePolicyForLambda = (
  name: string,
  bucket: aws.s3.BucketV2,
  prefix?: string
) => {
  const resourceArn = prefix
    ? bucket.arn.apply((arn) => `${arn}/${prefix}/*`)
    : bucket.arn.apply((arn) => `${arn}/*`);

  return new aws.iam.Policy(`${stageName}-${name}BucketWriteLambdaPolicy`, {
    description: 'Policy to allow Lambda to write to S3 bucket',
    policy: pulumi.all([bucket.arn, resourceArn]).apply(([bucketArn, objArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:PutObject', 's3:PutObjectAcl', 's3:DeleteObject'],
            Resource: objArn,
          },
          {
            Effect: 'Allow',
            Action: ['s3:ListBucket', 's3:GetBucketLocation'],
            Resource: bucketArn,
          },
        ],
      })
    ),
  });
};

/**
 * Create an IAM policy for full S3 access (read + write)
 * @param name - The name for the policy
 * @param bucket - The S3 bucket
 * @param prefix - Optional prefix to restrict access to specific paths
 */
export const createBucketFullAccessPolicyForLambda = (
  name: string,
  bucket: aws.s3.BucketV2,
  prefix?: string
) => {
  const resourceArn = prefix
    ? bucket.arn.apply((arn) => `${arn}/${prefix}/*`)
    : bucket.arn.apply((arn) => `${arn}/*`);

  return new aws.iam.Policy(`${stageName}-${name}BucketFullAccessLambdaPolicy`, {
    description: 'Policy to allow Lambda full access to S3 bucket',
    policy: pulumi.all([bucket.arn, resourceArn]).apply(([bucketArn, objArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:GetObjectVersion',
              's3:GetObjectAttributes',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: objArn,
          },
          {
            Effect: 'Allow',
            Action: ['s3:ListBucket', 's3:GetBucketLocation'],
            Resource: bucketArn,
          },
        ],
      })
    ),
  });
};

/**
 * Add S3 read permissions to a Lambda role
 * @param name - The name for the policy
 * @param bucket - The S3 bucket
 * @param role - Optional existing role, or create a new one
 * @param prefix - Optional prefix to restrict access to specific paths
 */
export const addBucketReadPolicyToRole = (
  name: string,
  bucket: aws.s3.BucketV2,
  role?: aws.iam.Role,
  prefix?: string
): Role => {
  let newRole = role || createBasicLambdaRole(name);

  const resourceArn = prefix
    ? bucket.arn.apply((arn) => `${arn}/${prefix}/*`)
    : bucket.arn.apply((arn) => `${arn}/*`);

  const s3ReadPolicy = new aws.iam.RolePolicy(`${stageName}-${name}S3ReadPolicy`, {
    role: newRole.id,
    policy: pulumi.all([bucket.arn, resourceArn]).apply(([bucketArn, objArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:GetObject', 's3:GetObjectVersion', 's3:GetObjectAttributes'],
            Resource: objArn,
          },
          {
            Effect: 'Allow',
            Action: ['s3:ListBucket', 's3:GetBucketLocation'],
            Resource: bucketArn,
          },
        ],
      })
    ),
  });

  return newRole;
};

/**
 * Add S3 write permissions to a Lambda role
 * @param name - The name for the policy
 * @param bucket - The S3 bucket
 * @param role - Optional existing role, or create a new one
 * @param prefix - Optional prefix to restrict access to specific paths
 */
export const addBucketWritePolicyToRole = (
  name: string,
  bucket: aws.s3.BucketV2,
  role?: aws.iam.Role,
  prefix?: string
): Role => {
  let newRole = role || createBasicLambdaRole(name);

  const resourceArn = prefix
    ? bucket.arn.apply((arn) => `${arn}/${prefix}/*`)
    : bucket.arn.apply((arn) => `${arn}/*`);

  const s3WritePolicy = new aws.iam.RolePolicy(`${stageName}-${name}S3WritePolicy`, {
    role: newRole.id,
    policy: pulumi.all([bucket.arn, resourceArn]).apply(([bucketArn, objArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: ['s3:PutObject', 's3:PutObjectAcl', 's3:DeleteObject'],
            Resource: objArn,
          },
          {
            Effect: 'Allow',
            Action: ['s3:ListBucket', 's3:GetBucketLocation'],
            Resource: bucketArn,
          },
        ],
      })
    ),
  });

  return newRole;
};

/**
 * Add full S3 access permissions to a Lambda role
 * @param name - The name for the policy
 * @param bucket - The S3 bucket
 * @param role - Optional existing role, or create a new one
 * @param prefix - Optional prefix to restrict access to specific paths
 */
export const addBucketFullAccessPolicyToRole = (
  name: string,
  bucket: aws.s3.BucketV2,
  role?: aws.iam.Role,
  prefix?: string
): Role => {
  let newRole = role || createBasicLambdaRole(name);

  const resourceArn = prefix
    ? bucket.arn.apply((arn) => `${arn}/${prefix}/*`)
    : bucket.arn.apply((arn) => `${arn}/*`);

  const s3FullAccessPolicy = new aws.iam.RolePolicy(`${stageName}-${name}S3FullAccessPolicy`, {
    role: newRole.id,
    policy: pulumi.all([bucket.arn, resourceArn]).apply(([bucketArn, objArn]) =>
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:GetObjectVersion',
              's3:GetObjectAttributes',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: objArn,
          },
          {
            Effect: 'Allow',
            Action: ['s3:ListBucket', 's3:GetBucketLocation'],
            Resource: bucketArn,
          },
        ],
      })
    ),
  });

  return newRole;
};

/**
 * Add permission for a Lambda to be triggered by S3 events
 * @param name - The name for the permission
 * @param lambda - The Lambda function
 * @param bucket - The S3 bucket
 */
export const addLambdaPermissionForS3 = (
  name: string,
  lambda: aws.lambda.Function,
  bucket: aws.s3.BucketV2
) => {
  return new aws.lambda.Permission(`${stageName}-${name}S3Permission`, {
    action: 'lambda:InvokeFunction',
    function: lambda.name,
    principal: 's3.amazonaws.com',
    sourceArn: bucket.arn,
  });
};

/**
 * Create an S3 bucket notification for Lambda
 * @param name - The name for the notification
 * @param bucket - The S3 bucket
 * @param lambda - The Lambda function
 * @param events - S3 events to trigger on
 * @param prefix - Optional prefix filter
 * @param suffix - Optional suffix filter
 */
export const createBucketNotification = (
  name: string,
  bucket: aws.s3.BucketV2,
  lambda: aws.lambda.Function,
  events: string[] = ['s3:ObjectCreated:*'],
  prefix?: string,
  suffix?: string
) => {
  const filterConditions: any = {};
  if (prefix) filterConditions.prefix = prefix;
  if (suffix) filterConditions.suffix = suffix;

  return new aws.s3.BucketNotification(
    `${stageName}-${name}Notification`,
    {
      bucket: bucket.id,
      lambdaFunctions: [
        {
          lambdaFunctionArn: lambda.arn,
          events: events,
          ...(Object.keys(filterConditions).length > 0 && {
            filterPrefix: filterConditions.prefix,
            filterSuffix: filterConditions.suffix,
          }),
        },
      ],
    },
    { dependsOn: [bucket, lambda] }
  );
};
