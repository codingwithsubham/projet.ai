const { Pinecone } = require("@pinecone-database/pinecone");

let pineconeClient = null;
let pineconeIndex = null;

const getPineconeClient = () => {
  if (!pineconeClient) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY environment variable is required");
    }
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }

  return pineconeClient;
};

const getPineconeIndex = () => {
  if (!pineconeIndex) {
    const client = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || "aidlc-index";
    pineconeIndex = client.index(indexName);
  }
  return pineconeIndex;
};

/**
 * Verify Pinecone connection and index configuration.
 */
const verifyPineconeSetup = async () => {
  try {
    const client = getPineconeClient();
    const indexName = process.env.PINECONE_INDEX || "aidlc-index";

    const { indexes } = await client.listIndexes();
    const indexInfo = indexes?.find((i) => i.name === indexName);

    if (!indexInfo) {
      console.error(`❌ Pinecone index "${indexName}" not found!`);
      return false;
    }

    console.log(`✅ Pinecone index "${indexName}" ready`);
    return true;
  } catch (err) {
    console.error("❌ Pinecone verification failed:", err.message);
    return false;
  }
};

module.exports = { getPineconeClient, getPineconeIndex, verifyPineconeSetup };
