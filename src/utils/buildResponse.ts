import type { APIGatewayProxyResult } from 'aws-lambda';

const headers = {
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
  'Access-Control-Allow-Credentials': true,
  'Strict-Transport-Security': 'max-age=31536000;includeSubDomains',
  'X-XSS-Protection': '0',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'Deny',
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'Content-Security-Policy': "frame-ancestors 'none'; default-src 'self'",
  'Referrer-Policy': 'no-referrer',
  'Feature-Policy': 'none',
  'Content-Type': 'application/json',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

export const buildResponse = (statusCode: number, body: string): APIGatewayProxyResult => ({
  isBase64Encoded: false,
  statusCode,
  headers,
  body,
});
