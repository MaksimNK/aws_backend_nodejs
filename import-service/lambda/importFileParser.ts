import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const importFileParser = async (event: S3Event) => {
  try {
    console.log('S3 event', { event });
    
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      
      if (!key.startsWith('uploaded/')) {
        continue;
      }
      
      console.log('Processing file', { bucket, key });
      
      const { Body } = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      
      
      const stream = Body as Readable;
      
      await new Promise((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on('data', (data) => {
            console.log('Parsed record', { data });
          })
          .on('error', (error) => {
            console.error('CSV parse error', { error });
            reject(error);
          })
          .on('end', () => {
            console.log('Parsing complete');
            resolve(null);
          });
      });
    }
    
    return { statusCode: 200, body: 'Done' };
  } catch (error) {
    console.error('Error processing event', { error });
    throw error;
  }
};
