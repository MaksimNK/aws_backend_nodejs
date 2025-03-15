import { SQSEvent, SQSHandler } from "aws-lambda";
import { DynamoDB, SNS } from "aws-sdk";
import { v4 as uuidv4 } from 'uuid';


const dynamodb = new DynamoDB.DocumentClient();
const sns = new SNS();

export const handler: SQSHandler = async (event: SQSEvent) => {
    try {
        for (const record of event.Records) {
            const productData = JSON.parse(record.body);
            console.log("Product", productData);

            if (!productData.title || !productData.description || !productData.price) {
                console.error('Invalid Data', productData);
                continue;
            }

            const productId = uuidv4();
            const product = {
                id: productId,
                title: productData.title,
                description: productData.description,
                price: productData.price,
            }
            
            await dynamodb.put({
                TableName: process.env.PRODUCTS_TABLE || 'products',
                Item: product,
            }).promise();

            console.log('Product created:', product);

            await sns.publish({
                TopicArn: process.env.SNS_TOPIC_ARN,
                Subject: 'New Product Created',
                Message: JSON.stringify({
                    message: 'New product has been created',
                    product,
                }),
                MessageAttributes: {
                    productId: {
                        DataType: 'String',
                        StringValue: product.id,
                    },
                    price: {
                        DataType: 'Number',
                        StringValue: product.price.toString(),
                    },
                },
            }).promise();

            console.log('SNS notification sent', product.id);
        }
    } catch (error) {
        console.error("Eror in batch Proccess");
        throw error;
    }
}

