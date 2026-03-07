require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");
const { verifyLangSmithConnection } = require("./openai/langSmith");
const { verifyPineconeSetup } = require("./config/pinecone");
const { bootstrapUsers } = require("./services/auth.service");
const { refreshApiKeyCache } = require("./services/apiKeyCache.service");

const port = process.env.PORT || 5000;

async function start() {
  await verifyLangSmithConnection();
  await connectDB();
  await bootstrapUsers();
  await refreshApiKeyCache();
  await verifyPineconeSetup();

  app.listen(port, () => {
    console.log(`✅ Server Started on PORT ${port}.`);
  });
}

start();