import { importProductsFile } from '../lambda/importProductsFile';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    PutObjectCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const mockS3Client = new S3Client({});

describe('importProductsFile', () => {
  it('should return a signed URL for valid file name', async () => {
    const mockUrl = 'https://test-s3-url.com';
    (getSignedUrl as jest.Mock).mockResolvedValue(mockUrl);

    const mockEvent = {
      queryStringParameters: { name: 'test.csv' },
    } as unknown as APIGatewayProxyEvent;

    const result = await importProductsFile(mockEvent);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toBe(mockUrl);
  });

  it('should return 400 if file name is missing', async () => {
    const mockEvent = {
      queryStringParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await importProductsFile(mockEvent);
    
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toBe('File name is required');
  });

  it('should return 500 if signed URL generation fails', async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(new Error('Signed URL error'));

    const mockEvent = {
      queryStringParameters: { name: 'test.csv' },
    } as unknown as APIGatewayProxyEvent;

    const result = await importProductsFile(mockEvent);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).message).toBe('Error generating signed URL');
  });
});
