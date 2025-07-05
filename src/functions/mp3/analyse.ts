import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const bucket = process.env.BUCKET_NAME;
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const filename = event.queryStringParameters?.file;
  if (!filename) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing file query parameter' }),
    };
  }
  try {
    const command = new GetObjectCommand({ Bucket: bucket!, Key: filename });
    const response = await s3.send(command);
    const fileBuffer = await response.Body?.transformToByteArray();

    if (!fileBuffer) {
      throw new Error('Failed to read file content');
    }

    // You can process fileBuffer as needed
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Loaded file from S3: ${bucket}/${filename}, size: ${fileBuffer.length} bytes`,
        size: fileBuffer.length,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        error: `Error loading file from S3: ${bucket}/${filename}`,
        details: err.message,
      }),
    };
  }
};
