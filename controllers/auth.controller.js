const authService = require("../services/auth.service");

const login = async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if ((!username && !email) || !password) {
      return res.status(400).json({
        success: false,
        message: "username/email and password are required",
      });
    }

    const result = await authService.login({ username, email, password });

    if (!result) {
      return res.status(401).json({
        success: false,
        message: "Invalid username/email or password",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

module.exports = { login };