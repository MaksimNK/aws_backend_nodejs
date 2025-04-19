import NodeCache from 'node-cache';

class CacheService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 120, checkperiod: 120 });
  }
  get(key) { return this.cache.get(key); }
  set(key, val) { return this.cache.set(key, val); }
  del(key) { return this.cache.del(key); }
}

export const cacheService = new CacheService();
