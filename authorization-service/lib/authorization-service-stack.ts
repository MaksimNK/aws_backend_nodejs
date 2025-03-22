import * as cdk from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly authorizerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basicAuthorizer = new NodejsFunction(this, 'BasicAuthorizer', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, 'lambdas/basicAuthorizer.ts'),
      handler: 'handler',
      environment: {
        MaksimNK: process.env.MaksimNK || 'TEST_PASSWORD'
      },
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });

    basicAuthorizer.addPermission('APIGWInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction'
    });

    basicAuthorizer.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'execute-api:Invoke'
        ],
        resources: ['*']
      })
    );

    this.authorizerFunction = basicAuthorizer;

    new cdk.CfnOutput(this, 'AuthorizerFunctionArn', {
      value: basicAuthorizer.functionArn,
      description: 'The ARN of the Authorizer Lambda function',
      exportName: 'AuthorizerFunctionArn'
    });
  }
}
