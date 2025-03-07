import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({ region: "us-east-1" });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log("Received event:", JSON.stringify(event));
    try {
        const body = event.body ? JSON.parse(event.body) : {};

        if (!body.title || body.title.trim() === "") {
            console.log("Invalid product data:", body);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid product data: 'title' is required." })
            };
        }

        const productId = uuidv4();

        const productItem = {
            id: { S: productId },
            title: { S: body.title },
            description: { S: body.description || "" },
            price: { N: String(body.price || 0) }
        };



        const stockItem = {
            product_id: { S: productId },
            count: { N: "50" }
        }

        const params = {
            TransactItems: [
                {
                    Put: {
                        TableName: "products",
                        Item: productItem,
                        ConditionExpression: "attribute_not_exists(id)"
                    }
                },
                {
                    Put: {
                        TableName: "stocks",
                        Item: stockItem,
                        ConditionExpression: "attribute_not_exists(product_id)"
                    }
                }
            ]
        }

        await client.send(new TransactWriteItemsCommand(params));
        console.log("Successfully created product and stock with productId:", productId);

        return {
            statusCode: 201,
            body: JSON.stringify({ message: "Product created", productId })
        }

    } catch (error) {
        console.error("Unhandled error in createProduct lambda:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal server error" })
        };
    }
}