import { Context, SQSEvent } from 'aws-lambda';
import { DynamoDB, SNS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({
    v4: () => 'mock-uuid'
}));

const mockDocumentClient = {
    put: jest.fn().mockReturnValue({
        promise: jest.fn()
    })
};

const mockSNS = {
    publish: jest.fn().mockReturnValue({
        promise: jest.fn()
    })
};

jest.mock('aws-sdk', () => ({
    DynamoDB: {
        DocumentClient: jest.fn(() => mockDocumentClient)
    },
    SNS: jest.fn(() => mockSNS)
}));

import { handler } from '../lib/lambdas/catalogBatchProcess';

describe('catalogBatchProcess Lambda', () => {
    const mockContext: Context = {
        callbackWaitsForEmptyEventLoop: true,
        functionName: 'test',
        functionVersion: '1',
        invokedFunctionArn: 'test:arn',
        memoryLimitInMB: '128',
        awsRequestId: 'test-id',
        logGroupName: 'test-group',
        logStreamName: 'test-stream',
        getRemainingTimeInMillis: () => 1000,
        done: () => {},
        fail: () => {},
        succeed: () => {},
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockDocumentClient.put.mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
        });
        
        mockSNS.publish.mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
        });

        process.env.PRODUCTS_TABLE = 'test-products';
        process.env.SNS_TOPIC_ARN = 'test-topic-arn';
    });

    it('should process valid product data successfully', async () => {
        const validProduct = {
            title: 'Test Product',
            description: 'Test Description',
            price: 19.99
        };

        const event: SQSEvent = {
            Records: [{
                body: JSON.stringify(validProduct),
                messageId: '1',
                receiptHandle: 'test-handle',
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: '1234567890',
                    SenderId: 'TESTID',
                    ApproximateFirstReceiveTimestamp: '1234567890'
                },
                messageAttributes: {},
                md5OfBody: 'test-md5',
                eventSource: 'aws:sqs',
                eventSourceARN: 'test:arn',
                awsRegion: 'us-east-1'
            }]
        };

        await handler(event, mockContext, () => {});

        expect(mockDocumentClient.put).toHaveBeenCalledWith({
            TableName: 'test-products',
            Item: {
                id: 'mock-uuid',
                title: 'Test Product',
                description: 'Test Description',
                price: 19.99
            }
        });

        expect(mockSNS.publish).toHaveBeenCalledWith({
            TopicArn: 'test-topic-arn',
            Subject: 'New Product Created',
            Message: JSON.stringify({
                message: 'New product has been created',
                product: {
                    id: 'mock-uuid',
                    title: 'Test Product',
                    description: 'Test Description',
                    price: 19.99
                }
            }),
            MessageAttributes: {
                productId: {
                    DataType: 'String',
                    StringValue: 'mock-uuid'
                },
                price: {
                    DataType: 'Number',
                    StringValue: '19.99'
                }
            }
        });
    });

    it('should skip invalid product data', async () => {
        const invalidProduct = {
            description: 'Test Description',
            price: 19.99
        };

        const event: SQSEvent = {
            Records: [{
                body: JSON.stringify(invalidProduct),
                messageId: '1',
                receiptHandle: 'test-handle',
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: '1234567890',
                    SenderId: 'TESTID',
                    ApproximateFirstReceiveTimestamp: '1234567890'
                },
                messageAttributes: {},
                md5OfBody: 'test-md5',
                eventSource: 'aws:sqs',
                eventSourceARN: 'test:arn',
                awsRegion: 'us-east-1'
            }]
        };

        await handler(event, mockContext, () => {});

        expect(mockDocumentClient.put).not.toHaveBeenCalled();
        expect(mockSNS.publish).not.toHaveBeenCalled();
    });

    it('should handle DynamoDB errors', async () => {
        const validProduct = {
            title: 'Test Product',
            description: 'Test Description',
            price: 19.99
        };

        const event: SQSEvent = {
            Records: [{
                body: JSON.stringify(validProduct),
                messageId: '1',
                receiptHandle: 'test-handle',
                attributes: {
                    ApproximateReceiveCount: '1',
                    SentTimestamp: '1234567890',
                    SenderId: 'TESTID',
                    ApproximateFirstReceiveTimestamp: '1234567890'
                },
                messageAttributes: {},
                md5OfBody: 'test-md5',
                eventSource: 'aws:sqs',
                eventSourceARN: 'test:arn',
                awsRegion: 'us-east-1'
            }]
        };

        mockDocumentClient.put.mockReturnValue({
            promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
        });

        await expect(handler(event, mockContext, () => {}))
            .rejects
            .toThrow('DynamoDB error');

        expect(mockSNS.publish).not.toHaveBeenCalled();
    });
});
