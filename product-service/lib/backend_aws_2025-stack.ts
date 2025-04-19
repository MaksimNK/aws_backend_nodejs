import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { SubscriptionFilter, Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dotenv from 'dotenv';

dotenv.config();

export class BackendAws2025Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const catalogItemQueue = new Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    const createProductTopic = new Topic(this, 'CreateProductTopic', {
      topicName: 'createProductTopic'
    });

    createProductTopic.addSubscription(
      new EmailSubscription(process.env.EMAIL_HIGH_PRICE!, {
        filterPolicy: {
          price: SubscriptionFilter.numericFilter({
            greaterThanOrEqualTo: 100,
          })
        }
      })
    )

    createProductTopic.addSubscription(
      new EmailSubscription(process.env.EMAIL_LOW_PRICE!, {
        filterPolicy: {
          price: SubscriptionFilter.numericFilter({
            lessThan: 100,
          })
        }
      })
    )


    const catalogBatchProcess = new nodejsLambda.NodejsFunction(this, 'CatalogBatchProcess', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/catalogBatchProcess.ts'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        PRODUCTS_TABLE: "products",
        SNS_TOPIC_ARN: createProductTopic.topicArn,
      }
    });
    catalogBatchProcess.addEventSource(
      new SqsEventSource(catalogItemQueue, {
        batchSize: 5,
      })
    )

    createProductTopic.grantPublish(catalogBatchProcess);

    catalogBatchProcess.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "dynamodb:PutItem",
        "dynamodb:TransactWriteItems"
      ],
      resources: [
        `arn:aws:dynamodb:us-east-1:${this.account}:table/products`,
        `arn:aws:dynamodb:us-east-1:${this.account}:table/stocks`
      ]
    }));

    const getProductsListLambda = new nodejsLambda.NodejsFunction(this, 'GetProductsListHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/getProductsList.ts'),
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        PRODUCTS_TABLE: "products",
        STOCKS_TABLE: "stocks"
      }
    });

    const getProductsByIdLambda = new nodejsLambda.NodejsFunction(this, 'GetProductsByIdHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/getProductById.ts'),
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        PRODUCTS_TABLE: "products",
        STOCKS_TABLE: "stocks"
      }
    });

    const createProductLambda = new nodejsLambda.NodejsFunction(this, "CreateProductHandler", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, 'lambdas/createProduct.ts'),
      bundling: {
        minify: true,
        sourceMap: true,
      },
      environment: {
        PRODUCTS_TABLE: "products",
        STOCKS_TABLE: "stocks"
      }
    });

    createProductLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        "dynamodb:PutItem",
        "dynamodb:TransactWriteItems"
      ],
      resources: [
        `arn:aws:dynamodb:us-east-1:${this.account}:table/products`,
        `arn:aws:dynamodb:us-east-1:${this.account}:table/stocks`
      ]
    }));

    getProductsListLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan", "dynamodb:GetItem"],
      resources: [
        `arn:aws:dynamodb:us-east-1:${this.account}:table/products`,
        `arn:aws:dynamodb:us-east-1:${this.account}:table/stocks`
      ]
    }));

    getProductsByIdLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem"],
      resources: [
        `arn:aws:dynamodb:us-east-1:${this.account}:table/products`,
        `arn:aws:dynamodb:us-east-1:${this.account}:table/stocks`
      ]
    }));

    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    const products = api.root.addResource('products');
    products.addMethod('GET', new apigateway.LambdaIntegration(getProductsListLambda));
    products.addMethod('POST', new apigateway.LambdaIntegration(createProductLambda));

    const productById = products.addResource('{productId}');
    productById.addMethod('GET', new apigateway.LambdaIntegration(getProductsByIdLambda), {
      requestParameters: {
        'method.request.path.productId': true,
      }
    });
  }
}
