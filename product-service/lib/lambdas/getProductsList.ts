import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { formatResponse } from "./utils";


const client = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const STOCKS_TABLE = process.env.STOCKS_TABLE;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const productsData = await ddbDocClient.send(new ScanCommand({ TableName: PRODUCTS_TABLE }));
        const stocksData = await ddbDocClient.send(new ScanCommand({ TableName: STOCKS_TABLE }));

        const products = productsData.Items || [];
        const stocks = stocksData.Items || [];

        const joinedProducts = products.map((product) => {
            const stock = stocks.find((s) => s.product_id === product.id);
            return {
                ...product,
                count: stock ? stock.count : 0
            };
        });

        return formatResponse(200, joinedProducts);
    } catch (error) {
        console.error("Error fetching products:", error);
        return formatResponse(500, {
            error: "Internal Server Error",
            message: "An unexpected error occurred",
        });
    }
};
