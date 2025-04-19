import { cacheService } from './cacheService.js';

export const handleRequest = async (req, res, serviceUrl, serviceName) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const servicePath = pathSegments.slice(1).join('/'); 
  const search   = parsed.search;                  
  
  const base = serviceUrl.endsWith('/') ? serviceUrl : serviceUrl + '/';
  
  const targetUrl = `${base}${servicePath}${search}`;
  
  console.log(`-- [BFF] ${req.method} /${serviceName}/${servicePath} → ${targetUrl}`);
  console.log('Auth header:', req.headers.authorization ?? 'none');

  const isProductsList = serviceName === 'product'
    && req.method === 'GET'
    && !parsed.searchParams.has('no-cache');
  if (isProductsList) {
    const cached = cacheService.get('productsList');
    if (cached) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Cache':      'HIT'
      });
      return res.end(JSON.stringify(cached));
    }
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
    }
    headers.Host = new URL(serviceUrl).host;

    const opts = {
      method: req.method,
      headers,
      body: ['POST','PUT','PATCH'].includes(req.method)
        ? JSON.stringify(req.body)
        : undefined,
    };

    const upstream = await fetch(targetUrl, opts);
    const text     = await upstream.text();
    const status   = upstream.status;

    if (isProductsList && status === 200) {
      cacheService.set('productsList', JSON.parse(text));
      console.log('-- [BFF] cache MISS → stored');
    }
    if (serviceName === 'product' && req.method === 'POST' && status === 200) {
      cacheService.del('productsList');
      console.log('-- [BFF] cache invalidated');
    }

    const responseHeaders = { 'X-Cache': isProductsList ? 'MISS' : 'BYPASS' };
    upstream.headers.forEach((v,k) => responseHeaders[k] = v);

    res.writeHead(status, responseHeaders);
    res.end(text);

  } catch (err) {
    console.error('-- [BFF] proxy error:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error:   'Cannot process request',
      details: err.message
    }));
  }
};
