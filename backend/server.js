require("dotenv").config();
const app = require("./app");
const { connectDB } = require("./config/db");
const { verifyLangSmithConnection } = require("./openai/langSmith");
const { verifyPineconeSetup } = require("./config/pinecone");

const port = process.env.PORT || 5000;

async function start() {
  await verifyLangSmithConnection();
  await connectDB();
  await verifyPineconeSetup();

  app.listen(port, () => {
    console.log(`✅ Server Started on PORT ${port}.`);
  });
}

start();