import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../lib/lambdas/getProductById';
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const createMockEvent = (pathParameters: { productId: string } | null): APIGatewayProxyEvent => ({
    pathParameters,
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/products',
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

jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
    const mockSend = jest.fn();
    const mockDdbClient = { send: mockSend };
    
    return {
        DynamoDBDocumentClient: {
            from: jest.fn().mockReturnValue(mockDdbClient)
        },
        GetCommand: jest.fn().mockImplementation((params) => params)
    };
});

describe('getProductById Lambda', () => {
    let mockSend: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSend = DynamoDBDocumentClient.from(new DynamoDBClient({})).send as jest.Mock;
    });

    it('should return 400 when productId is missing', async () => {
        const event = createMockEvent(null);

        const response = await handler(event);

        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body)).toEqual({
            error: 'Bad Request',
            message: 'Product ID is required'
        });
    });

    it('should return 404 when product is not found', async () => {
        const event = createMockEvent({ productId: 'non-existent-id' });

        mockSend.mockResolvedValueOnce({ Item: null });

        const response = await handler(event);

        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body)).toEqual({
            error: 'Not Found',
            message: 'Product with ID non-existent-id not found'
        });
    });

    it('should return 200 with joined product data when product exists', async () => {
        const event = createMockEvent({ productId: 'test-id' });

        const mockProduct = {
            id: 'test-id',
            title: 'Test Product',
            price: 99.99
        };

        const mockStock = {
            product_id: 'test-id',
            count: 5
        };

        mockSend
            .mockResolvedValueOnce({ Item: mockProduct })
            .mockResolvedValueOnce({ Item: mockStock });

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            ...mockProduct,
            count: 5
        });
    });

    it('should handle product with no stock', async () => {
        const event = createMockEvent({ productId: 'test-id' });

        const mockProduct = {
            id: 'test-id',
            title: 'Test Product',
            price: 99.99
        };

        mockSend
            .mockResolvedValueOnce({ Item: mockProduct })
            .mockResolvedValueOnce({ Item: null });

        const response = await handler(event);

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({
            ...mockProduct,
            count: 0
        });
    });

    it('should return 500 when an error occurs', async () => {
        const event = createMockEvent({ productId: 'test-id' });

        mockSend.mockRejectedValueOnce(new Error('Database error'));

        const response = await handler(event);

        expect(response.statusCode).toBe(500);
        expect(JSON.parse(response.body)).toEqual({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred'
        });
    });
});
