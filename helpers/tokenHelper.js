const crypto = require("crypto");

const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const getTokenSecret = () => process.env.AUTH_TOKEN_SECRET || "dev-auth-secret";

const toTimingSafeBuffer = (value) => Buffer.from(String(value || ""), "utf8");

const parseAuthToken = (token) => {
  const normalized = String(token || "").trim();
  const parts = normalized.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return { encodedPayload: parts[0], signature: parts[1] };
};

const createAuthToken = (user) => {
  const payload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    iat: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getTokenSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
};

const verifyAuthToken = (token, options = {}) => {
  const parsed = parseAuthToken(token);
  if (!parsed) return null;

  const { encodedPayload, signature } = parsed;
  const secret = getTokenSecret();
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  const actualSignatureBuffer = toTimingSafeBuffer(signature);
  const expectedSignatureBuffer = toTimingSafeBuffer(expectedSignature);

  if (actualSignatureBuffer.length !== expectedSignatureBuffer.length) {
    return null;
  }

  const signatureIsValid = crypto.timingSafeEqual(
    actualSignatureBuffer,
    expectedSignatureBuffer
  );

  if (!signatureIsValid) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || !payload.sub || !payload.iat) {
    return null;
  }

  const maxAgeMs = Number.isFinite(Number(options.maxAgeMs))
    ? Number(options.maxAgeMs)
    : Number(process.env.AUTH_TOKEN_TTL_MS) || DEFAULT_TOKEN_TTL_MS;

  if (maxAgeMs > 0) {
    const ageMs = Date.now() - Number(payload.iat);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) {
      return null;
    }
  }

  return payload;
};

module.exports = { createAuthToken, verifyAuthToken };