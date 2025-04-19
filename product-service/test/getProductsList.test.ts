import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../lib/lambdas/getProductsList';
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const createMockEvent = (): APIGatewayProxyEvent => ({
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/products',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
        accountId: '',
        apiId: '',
        authorizer: {},
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        identity: {
            accessKey: null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
            clientCert: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            sourceIp: '',
            user: null,
            userAgent: null,
            userArn: null,
        },
        path: '/products',
        stage: 'dev',
        requestId: '',
        requestTimeEpoch: 0,
        resourceId: '',
        resourcePath: ''
    },
    resource: ''
});

console.error = jest.fn();

const mockScanCommand = jest.fn().mockImplementation((params) => params);

jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: jest.fn().mockReturnValue({
            send: jest.fn()
        })
    },
    ScanCommand: jest.fn().mockImplementation((params) => {
        console.log('ScanCommand called with params:', params);
        mockScanCommand(params);
        return params;
    })
}));

describe('getProductsList Lambda', () => {
    let mockSend: jest.Mock;
    let originalEnv: NodeJS.ProcessEnv;

    beforeAll(() => {
        process.env.PRODUCTS_TABLE = 'ProductsTable';
        process.env.STOCKS_TABLE = 'StocksTable';
    });

    beforeEach(() => {
        originalEnv = { ...process.env };
        
        jest.clearAllMocks();
        mockSend = DynamoDBDocumentClient.from(new DynamoDBClient({})).send as jest.Mock;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should return 200 with empty array when no products exist', async () => {
        const event = createMockEvent();

        mockSend
            .mockResolvedValueOnce({ Items: [] })
            .mockResolvedValueOnce({ Items: [] });

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual([]);
    });

    it('should return 200 with joined products and stocks', async () => {
        const event = createMockEvent();

        const mockProducts = [
            { id: 'prod1', title: 'Product 1', price: 10 },
            { id: 'prod2', title: 'Product 2', price: 20 }
        ];

        const mockStocks = [
            { product_id: 'prod1', count: 5 },
            { product_id: 'prod2', count: 10 }
        ];

        mockSend
            .mockResolvedValueOnce({ Items: mockProducts })
            .mockResolvedValueOnce({ Items: mockStocks });

        const response = await handler(event);
        const expectedResult = [
            { id: 'prod1', title: 'Product 1', price: 10, count: 5 },
            { id: 'prod2', title: 'Product 2', price: 20, count: 10 }
        ];

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual(expectedResult);
    });

    it('should handle products with missing stock information', async () => {
        const event = createMockEvent();

        const mockProducts = [
            { id: 'prod1', title: 'Product 1', price: 10 },
            { id: 'prod2', title: 'Product 2', price: 20 }
        ];

        const mockStocks = [
            { product_id: 'prod1', count: 5 }
            // No stock for prod2
        ];

        mockSend
            .mockResolvedValueOnce({ Items: mockProducts })
            .mockResolvedValueOnce({ Items: mockStocks });

        const response = await handler(event);
        const expectedResult = [
            { id: 'prod1', title: 'Product 1', price: 10, count: 5 },
            { id: 'prod2', title: 'Product 2', price: 20, count: 0 }
        ];

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual(expectedResult);
    });

    it('should return 500 when database error occurs', async () => {
        const event = createMockEvent();

        mockSend.mockRejectedValueOnce(new Error('Database error'));

        const response = await handler(event);

        expect(response.statusCode).toBe(500);
        expect(JSON.parse(response.body)).toEqual({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred'
        });
        expect(console.error).toHaveBeenCalled();
    });

    it('should handle null Items in response', async () => {
        const event = createMockEvent();

        mockSend
            .mockResolvedValueOnce({ Items: null })
            .mockResolvedValueOnce({ Items: null });

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual([]);
    });

});
