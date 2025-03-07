import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { insertProducts, products } from "./Product";
import { insertStocks } from "./Stock";

const client = new DynamoDBClient({ region: "us-east-1" });
const ddbDocClient = DynamoDBDocumentClient.from(client);

async function main() {
  await insertProducts(ddbDocClient);
  await insertStocks(ddbDocClient, products);
  console.log("All test data inserted successfully!");
}

main().catch((error) => console.error("Error executing script:", error));
