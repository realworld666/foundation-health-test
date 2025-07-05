import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Ping request received:", JSON.stringify(event, null, 2));

  const timestamp = new Date().toISOString();
  const requestId = event.requestContext?.requestId || "unknown";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify({
      message: "pong",
      timestamp,
      requestId,
      environment: process.env.NODE_ENV || "development",
      version: "1.0.0",
    }),
  };
};
