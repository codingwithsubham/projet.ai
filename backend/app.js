const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");
const mcpRoutes = require("./routes/mcp.routes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
}));

// MCP routes must be mounted before express.json() — the SSE transport reads the raw request stream
app.use("/api/mcp", mcpRoutes);

//app routes
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/api/v1", routes);

// Serve React build in production (frontend served through backend)
if (process.env.NODE_ENV === "production") {
  const reactBuild = path.join(__dirname, "../app/build");
  app.use(express.static(reactBuild));
  app.get("*", (req, res) => {
    res.sendFile(path.join(reactBuild, "index.html"));
  });
}

module.exports = app;