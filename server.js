require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");
const { verifyLangSmithConnection } = require("./openai/langSmith");
const { healthCheck } = require("./config/pgvector");
// const { bootstrapUsers } = require("./services/auth.service");
const { refreshApiKeyCache } = require("./services/apiKeyCache.service");

const port = process.env.PORT || 5000;

async function start() {
  await verifyLangSmithConnection();
  await connectDB();
  // await bootstrapUsers();
  await refreshApiKeyCache();
  
  // Verify PG Vector connection (tables created automatically by LangChain)
  const pgHealth = await healthCheck();
  if (pgHealth.healthy) {
    console.log(`✅ PG Vector connected (${pgHealth.latency}ms)`);
  } else {
    console.warn(`⚠️ PG Vector connection issue: ${pgHealth.error}`);
  }

  app.listen(port, () => {
    console.log(`✅ Server Started on PORT ${port}.`);
  });
}

start();