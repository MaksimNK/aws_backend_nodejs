import { APIGatewayProxyResult } from "aws-lambda";

export const formatResponse = (statusCode: number, body: any): APIGatewayProxyResult => {
    return {
      statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
  };