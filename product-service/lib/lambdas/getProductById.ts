import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { formatResponse } from "./utils";

const client = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const STOCKS_TABLE = process.env.STOCKS_TABLE;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const productId = event.pathParameters?.productId;

        if (!productId) {
            return formatResponse(400, {
                error: "Bad Request",
                message: "Product ID is required",
            });
        }

        const productResult = await ddbDocClient.send(new GetCommand({
            TableName: PRODUCTS_TABLE,
            Key: { id: productId }
        }));

        if (!productResult.Item) {
            return formatResponse(404, {
                error: "Not Found",
                message: `Product with ID ${productId} not found`,
            });
        }

        const stockResult = await ddbDocClient.send(new GetCommand({
            TableName: STOCKS_TABLE,
            Key: { product_id: productId }
        }));

        const stockCount = stockResult.Item ? stockResult.Item.count : 0;

        const joinedProduct = {
            ...productResult.Item,
            count: stockCount
        };

        return formatResponse(200, joinedProduct);
    } catch (error) {
        console.error("Error fetching product by id:", error);
        return formatResponse(500, {
            error: "Internal Server Error",
            message: "An unexpected error occurred",
        });
    }
};
