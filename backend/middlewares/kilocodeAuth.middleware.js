const requireKilocodeKey = (req, res, next) => {
  const headerKey = req.header("x-kilocode-key");
  const authHeader = req.header("authorization") || "";
  const bearerKey = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const provided = headerKey || bearerKey;
  const expected = process.env.KILOCODE_API_KEY;

  if (!expected) {
    return res.status(500).json({
      success: false,
      message: "KILOCODE_API_KEY is not configured",
    });
  }

  if (!provided || provided !== expected) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized Kilocode request",
    });
  }

  return next();
};

module.exports = { requireKilocodeKey };