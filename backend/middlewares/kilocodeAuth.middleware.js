const { mockAPIKeys } = require("../common/mockUsers");

const requireKilocodeKey = (req, res, next) => {
  const headerKey = req.header("x-kilocode-key");
  const authHeader = req.header("authorization") || "";
  const bearerKey = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const provided = headerKey || bearerKey;
  const expected = mockAPIKeys.find((k) => k.key === provided);

  if (!expected) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized Key request",
    });
  }

  req.keyData = expected;
  return next();
};

module.exports = { requireKilocodeKey };
