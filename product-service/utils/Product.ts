import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

export interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
}

export const products: Product[] = [
  { id: uuidv4(), title: "Widget", description: "A useful widget", price: 25 },
  { id: uuidv4(), title: "Gadget", description: "A cool gadget", price: 40 },
  { id: uuidv4(), title: "Doohickey", description: "An innovative tool", price: 15 }
];

export async function insertProducts(ddbDocClient: DynamoDBDocumentClient) {
  for (const product of products) {
    try {
      await ddbDocClient.send(
        new PutCommand({
          TableName: "products",
          Item: product
        })
      );
      console.log(`Inserted product: ${product.title}`);
    } catch (error) {
      console.error(`Error inserting product ${product.title}:`, error);
    }
  }
}
