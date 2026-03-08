const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "knowledgebase");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const sanitizeBaseName = (name = "file") =>
  name.replace(/[^\w.-]/g, "_").replace(/\s+/g, "_");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "document", ext);
    const safeBase = sanitizeBaseName(base);
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const allowedTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream", // fallback from some clients
]);

const allowedExtensions = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".doc",
  ".docx",
]);

const fileFilter = (_req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase();
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (allowedTypes.has(mime) || allowedExtensions.has(ext)) {
    return cb(null, true);
  }

  return cb(
    new Error("Unsupported file type. Allowed: pdf, txt, md, markdown, doc, docx")
  );
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadKnowledgeDocument = upload.single("document");

module.exports = { uploadKnowledgeDocument };