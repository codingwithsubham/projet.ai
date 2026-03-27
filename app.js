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
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/api/v1", routes);

app.use(express.static('app/build'));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'app', 'build', 'index.html'));
});

module.exports = app;