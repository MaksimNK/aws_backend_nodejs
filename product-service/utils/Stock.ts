import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Product } from "./Product";

export interface Stock {
  product_id: string;
  count: number;
}

export async function insertStocks(ddbDocClient: DynamoDBDocumentClient, products: Product[]) {
  for (const product of products) {
    const stock: Stock = {
      product_id: product.id,
      count: 50
    };

    try {
      await ddbDocClient.send(
        new PutCommand({
          TableName: "stocks",
          Item: stock
        })
      );
      console.log(`Inserted stock for product: ${product.title}`);
    } catch (error) {
      console.error(`Error inserting stock for ${product.title}:`, error);
    }
  }
}
