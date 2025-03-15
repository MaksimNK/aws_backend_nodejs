import { S3Event } from 'aws-lambda';
import {
  S3Client, GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

export const importFileParser = async (event: S3Event) => {
  try {
    console.log('S3 event', JSON.stringify(event, null, 2));
    
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      
      if (!key.startsWith('uploaded/')) {
        console.log('Skipping non-uploaded file:', key);
        continue;
      }
      
      console.log('Processing file', { bucket, key });
      
      try {
        const { Body } = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );
        
        if (!Body) {
          console.error('No body received from S3');
          continue;
        }
        
        const stream = Body as Readable;
        
        await new Promise((resolve, reject) => {
          const rows: any[] = [];
          
          stream
            .pipe(csvParser())
            .on('data', (data) => {
              rows.push(data);
            })
            .on('error', (error) => {
              console.error('CSV parse error', error);
              reject(error);
            })
            .on('end', async () => {
              console.log(`Parsed ${rows.length} records`);
              
              for (const data of rows) {
                try {
                  await sqsClient.send(new SendMessageCommand({
                    QueueUrl: process.env.SQS_URL || '',
                    MessageBody: JSON.stringify(data),
                  }));
                } catch (error) {
                  console.error('Error sending message to SQS:', error);
                }
              }
              
              try {
                const newKey = key.replace('uploaded/', 'processed/');
                
                await s3Client.send(new CopyObjectCommand({
                  Bucket: bucket,
                  CopySource: `${bucket}/${key}`,
                  Key: newKey
                }));
                console.log('File copied to processed folder:', newKey);
                
                await s3Client.send(new DeleteObjectCommand({
                  Bucket: bucket,
                  Key: key
                }));
                console.log('Original file deleted:', key);
                
                resolve(null);
              } catch (moveError) {
                console.error('Error moving file to processed folder:', moveError);
                reject(moveError);
              }
            });
        });
      } catch (processError) {
        console.error('Error processing file:', processError);
      }
    }
    
    return { statusCode: 200, body: 'Processing complete' };
  } catch (error) {
    console.error('Error in Lambda handler:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};