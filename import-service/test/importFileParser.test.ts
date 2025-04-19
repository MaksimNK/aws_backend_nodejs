import { importFileParser } from '../lambda/importFileParser';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

describe('importFileParser', () => {
  let sendSpy: jest.SpyInstance;

  beforeEach(() => {
    sendSpy = jest.spyOn(S3Client.prototype, 'send');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should process a valid CSV file from S3', async () => {
    const mockCsvData = 'name,price\nitem1,10\nitem2,20\n';
    const mockStream = new Readable();
    mockStream.push(mockCsvData);
    mockStream.push(null);
    sendSpy.mockResolvedValue({ Body: mockStream });
    const mockEvent = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'uploaded/test.csv' },
          },
        },
      ],
    } as any;
    const result = await importFileParser(mockEvent);
    expect(result).toEqual({ statusCode: 200, body: 'Done' });
  });

  it('should skip processing if file is not in "uploaded/" folder', async () => {
    const mockEvent = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'invalid/test.csv' },
          },
        },
      ],
    } as any;
    const result = await importFileParser(mockEvent);
    expect(result).toEqual({ statusCode: 200, body: 'Done' });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('should throw an error if S3 getObject fails', async () => {
    sendSpy.mockRejectedValue(new Error('S3 error'));
    const mockEvent = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'uploaded/test.csv' },
          },
        },
      ],
    } as any;
    await expect(importFileParser(mockEvent)).rejects.toThrow('S3 error');
  });
});
