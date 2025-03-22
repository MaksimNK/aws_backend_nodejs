import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, StatementEffect } from "aws-lambda";
import { generatePolicy } from "../../utils/generatePolicy";

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  console.log("EVENT: ", JSON.stringify(event));
  
  try {
    const authorizationHeader = event.authorizationToken;
    
    if (!authorizationHeader || !authorizationHeader.toLowerCase().startsWith('basic ')) {
      return generatePolicy('user', 'Deny' as StatementEffect, event.methodArn);
    }

    const encodedCreds = authorizationHeader.split(' ')[1];
    const buff = Buffer.from(encodedCreds, 'base64');
    const [username, password] = buff.toString('utf-8').split(':');

    console.log('Username:', username);
    console.log('Password:', password);
    
    const storedUserPassword = process.env[username];
    const isAuthorized = storedUserPassword && storedUserPassword === password;

    return generatePolicy(
      username, 
      isAuthorized ? 'Allow' as StatementEffect : 'Deny' as StatementEffect,
      event.methodArn
    );
  } catch (error) {
    console.error('Error:', error);
    return generatePolicy('user', 'Deny' as StatementEffect, event.methodArn);
  }
};
