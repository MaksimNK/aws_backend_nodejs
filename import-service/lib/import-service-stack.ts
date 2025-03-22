import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Queue } from 'aws-cdk-lib/aws-sqs';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basicAuthorizer = 'arn:aws:lambda:us-east-1:207567779149:function:AuthorizationServiceStack-BasicAuthorizer2B49C1FC-RX4ndUSg7wzU'

    const bucket = s3.Bucket.fromBucketName(this, 'ImportBucket', 'import-service-bucket-ts');

    const authorizerFn = lambda.Function.fromFunctionArn(
      this,
      'BasicAuthorizer',
      basicAuthorizer
    );

    authorizerFn.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:*/*/*/*`
    });


    const catalogItemsQueue = Queue.fromQueueArn(this, 'ImportCatalogItemsQueue',
      `arn:aws:sqs:${this.region}:${this.account}:catalogItemsQueue`
    );

    const importProductsFileLambda = new NodejsFunction(this, 'ImportProductsFileFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'importProductsFile',
      entry: path.join(__dirname, '../lambda/importProductsFile.ts'),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        REGION: this.region,
      },
      bundling: {
        externalModules: [],
        minify: true,
        sourceMap: true,
      },
    });

    const importFileParserFunction = new NodejsFunction(this, 'ImportFileParserFunction', {
      functionName: 'importFileParser',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'importFileParser',
      entry: path.join(__dirname, '../lambda/importFileParser.ts'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        SQS_URL: catalogItemsQueue.queueUrl,
        BUCKET_NAME: bucket.bucketName,
        REGION: this.region,
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    bucket.grantReadWrite(importProductsFileLambda);
    bucket.grantReadWrite(importFileParserFunction);
    catalogItemsQueue.grantSendMessages(importFileParserFunction);

    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    const authorizer = new apigateway.TokenAuthorizer(this, 'ImportApiAuthorizer', {
      handler: authorizerFn,
      identitySource: apigateway.IdentitySource.header('Authorization'),
      resultsCacheTtl: cdk.Duration.seconds(0)
    });

    const importResource = api.root.addResource('import');

    importResource.addMethod('GET',
      new apigateway.LambdaIntegration(importProductsFileLambda),
      {
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        requestParameters: {
          'method.request.querystring.name': true,
        },
      }
    );

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserFunction),
      { prefix: 'uploaded/' }
    );

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'The URL of the Import API',
    });
  }
}
