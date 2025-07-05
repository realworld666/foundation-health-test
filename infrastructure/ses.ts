import * as aws from '@pulumi/aws';
import { Role } from '@pulumi/aws/iam';
import { createBasicLambdaRole, stageName } from './config';

/**
 * Creates AWS SES resources for sending emails
 * @returns The SES resources
 */
export const createSesResources = () => {
  if (stageName === 'dev') {
    return {
      domainIdentity: undefined,
      domainDkim: undefined,
      domainMailFrom: undefined,
      emailIdentity: undefined,
      sesPolicy: undefined,
      sesRole: undefined,
    };
  }
  // Create an SES domain identity
  const domainIdentity = new aws.ses.DomainIdentity(`${stageName}-domain-identity`, {
    domain: 'rwscripts.com', // Replace with your actual domain
  });

  // Create a domain DKIM
  const domainDkim = new aws.ses.DomainDkim(`${stageName}-domain-dkim`, {
    domain: domainIdentity.domain,
  });

  // Create a domain mail from - Use apply() to properly handle the Output object
  const domainMailFrom = new aws.ses.MailFrom(`${stageName}-mail-from`, {
    domain: domainIdentity.domain,
    mailFromDomain: domainIdentity.domain.apply((domain) => `mail.${domain}`),
  });

  // Create an email identity for sending emails
  const emailIdentity = new aws.ses.EmailIdentity(`${stageName}-email-identity`, {
    email: 'noreply@rwscripts.com', // Replace with your actual email
  });

  // Create an IAM policy for SES access
  const sesPolicy = new aws.iam.Policy(`${stageName}-ses-policy`, {
    description: 'Policy for SES access',
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['ses:SendEmail', 'ses:SendRawEmail', 'ses:SendTemplatedEmail'],
          Resource: '*',
        },
      ],
    }),
  });

  // Create a role for Lambda functions to use SES
  const sesRole = new aws.iam.Role(`${stageName}-ses-role`, {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: 'lambda.amazonaws.com',
    }),
  });

  // Attach the SES policy to the role
  new aws.iam.RolePolicyAttachment(`${stageName}-ses-policy-attachment`, {
    role: sesRole.name,
    policyArn: sesPolicy.arn,
  });

  // Attach the Lambda basic execution role policy
  new aws.iam.RolePolicyAttachment(`${stageName}-lambda-basic-policy-attachment`, {
    role: sesRole.name,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
  });

  return {
    domainIdentity,
    domainDkim,
    domainMailFrom,
    emailIdentity,
    sesPolicy,
    sesRole,
  };
};

/**
 * Outputs the DNS records needed for SES domain verification
 * @param domainIdentity The SES domain identity
 * @param domainDkim The SES domain DKIM
 * @param domainMailFrom The SES domain mail from
 */
export const outputSesVerificationRecords = (
  domainIdentity: aws.ses.DomainIdentity,
  domainDkim: aws.ses.DomainDkim,
  domainMailFrom: aws.ses.MailFrom
) => {
  // Get the AWS region
  const region = aws.config.region || 'us-east-1'; // Default to us-east-1

  // Create verification records - log them to console

  // Domain verification record
  domainIdentity.domain.apply((domain) => {
    return domainIdentity.verificationToken.apply((token) => {
      console.log(`Domain verification record: _amazonses.${domain} TXT ${token}`);
    });
  });

  // DKIM records
  domainDkim.dkimTokens.apply((tokens) => {
    return domainIdentity.domain.apply((domain) => {
      tokens.forEach((token, i) => {
        console.log(
          `DKIM record ${i}: ${token}._domainkey.${domain} CNAME ${token}.dkim.amazonses.com`
        );
      });
    });
  });

  // MAIL FROM records
  domainMailFrom.mailFromDomain.apply((mailFromDomain) => {
    console.log(
      `MAIL FROM MX record: ${mailFromDomain} MX 10 feedback-smtp.${region}.amazonses.com`
    );
    console.log(`MAIL FROM SPF record: ${mailFromDomain} TXT "v=spf1 include:amazonses.com ~all"`);
  });

  // For advanced usage, you could return these records to expose them in your stack outputs
  // These structures correctly compose Output objects for downstream consumers

  // Domain verification record for output
  const verificationRecord = domainIdentity.domain.apply((domain) => {
    return domainIdentity.verificationToken.apply((token) => {
      return `_amazonses.${domain} TXT ${token}`;
    });
  });

  // MAIL FROM MX record for output
  const mailFromMxRecord = domainMailFrom.mailFromDomain.apply((mailFromDomain) => {
    return `${mailFromDomain} MX 10 feedback-smtp.${region}.amazonses.com`;
  });

  // MAIL FROM SPF record for output
  const mailFromSpfRecord = domainMailFrom.mailFromDomain.apply((mailFromDomain) => {
    return `${mailFromDomain} TXT "v=spf1 include:amazonses.com ~all"`;
  });

  return {
    verificationRecord,
    mailFromMxRecord,
    mailFromSpfRecord,
    // Note: DKIM records aren't included here because they're more complex to return
    // You would need to handle them specially in your stack file
  };
};

/**
 * Attaches SES permissions to a lambda role
 * @param name The name of the lambda
 * @param role Optional existing role to attach permissions to
 * @returns The role with SES permissions attached
 */
export const addSesRoleToLambda = (name: string, role?: Role): Role => {
  let newRole = role || createBasicLambdaRole(name);

  // Create a policy for SES access
  const sesPolicy = new aws.iam.Policy(`${stageName}-${name}-ses-policy`, {
    description: 'Policy for SES access',
    policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['ses:SendEmail', 'ses:SendRawEmail', 'ses:SendTemplatedEmail'],
          Resource: '*',
        },
      ],
    }),
  });

  // Attach the SES policy to the role
  new aws.iam.RolePolicyAttachment(`${stageName}-${name}-ses-policy-attachment`, {
    role: newRole.name,
    policyArn: sesPolicy.arn,
  });

  return newRole;
};
let recipientEmailIdentity = undefined;
if (stageName !== 'dev') {
  recipientEmailIdentity = new aws.ses.EmailIdentity('recipient-email-identity', {
    email: 'realworld666@gmail.com', // Add the email you're sending to
  });
}

// Export the recipient identity
export const recipientEmailVerification = recipientEmailIdentity?.email;
