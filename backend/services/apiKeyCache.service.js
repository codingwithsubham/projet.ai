const apiKeyService = require("./apiKey.service");

let cacheByHash = new Map();
let cacheMeta = {
  refreshedAt: null,
  totalActiveKeys: 0,
};

const refreshApiKeyCache = async () => {
  const activeKeys = await apiKeyService.getActiveApiKeysForCache();

  const next = new Map();
  for (const key of activeKeys) {
    next.set(key.keyHash, key);
  }

  cacheByHash = next;
  cacheMeta = {
    refreshedAt: new Date().toISOString(),
    totalActiveKeys: activeKeys.length,
  };

  return cacheMeta;
};

const getActiveApiKeyFromCache = (rawApiKey) => {
  const keyHash = apiKeyService.hashApiKey(rawApiKey);
  const keyEntry = cacheByHash.get(keyHash);

  if (!keyEntry) return null;

  // If a key expires while the process is running, prevent its usage immediately.
  if (new Date(keyEntry.expiresAt).getTime() <= Date.now()) {
    cacheByHash.delete(keyHash);
    cacheMeta.totalActiveKeys = Math.max(0, cacheMeta.totalActiveKeys - 1);
    return null;
  }

  return keyEntry;
};

const getApiKeyCacheMeta = () => ({ ...cacheMeta });

module.exports = {
  refreshApiKeyCache,
  getActiveApiKeyFromCache,
  getApiKeyCacheMeta,
};