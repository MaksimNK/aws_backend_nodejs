import http from 'http';
import dotenv from 'dotenv';
import { handleRequest } from './requestHandler.js';

dotenv.config();
const PORT = process.env.PORT || 3000;

const allowed = {
  product: process.env.PRODUCT,
  cart:    process.env.CART,
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'healthy' }));
  }

  if (req.url === '/' || req.url === '/favicon.ico') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('BFF Service is running');
  }

  try {
    if (!req.url) throw new Error('No URL');

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const svc = pathSegments[0];
    
    console.log(`Requested service: ${svc}`);
    if (!svc) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Not Found' }));
    }

    if (!allowed[svc]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid service' }));
    }

    let body = null;
    if (!['GET','DELETE','OPTIONS'].includes(req.method)) {
      body = await new Promise((resB, rej) => {
        let buf = '';
        req.on('data', c => buf += c);
        req.on('end', () => {
          try { resB(buf ? JSON.parse(buf) : null); }
          catch(e){ rej(e); }
        });
      });
    }

    await handleRequest(req, res, allowed[svc], svc, body);
  } catch (err) {
    console.error('-- [BFF] unexpected error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});

server.listen(PORT, () => {
  console.log(`BFF Service running on port ${PORT}`);
});
