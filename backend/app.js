const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./routes");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-kilocode-key"],
}));

app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/api/v1", routes);

module.exports = app;