const crypto = require("crypto");

const createAuthToken = (user) => {
  const payload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    iat: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = process.env.AUTH_TOKEN_SECRET || "dev-auth-secret";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
};

module.exports = { createAuthToken };