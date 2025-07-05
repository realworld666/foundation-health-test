import { buildResponse } from '@/utils/buildResponse';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { countFrames } from './logic';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Check if body exists and is base64 encoded
  if (!event.body) {
    return buildResponse(400, JSON.stringify({ error: 'No file data provided' }));
  }

  try {
    // Decode the base64 encoded file data
    const fileBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');

    const frames = countFrames(fileBuffer);

    // Return success response with file info
    return buildResponse(
      200,
      JSON.stringify({
        frameCount: frames,
      })
    );
  } catch (err: any) {
    console.error('Error uploading file:', err);
    return buildResponse(
      500,
      JSON.stringify({
        error: 'Error uploading file to S3',
        details: err.message,
      })
    );
  }
};
