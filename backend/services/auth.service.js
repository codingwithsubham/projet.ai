const { mockUsers } = require("../common/mockUsers");
const { createAuthToken } = require("../helpers/tokenHelper");

const sanitizeUser = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const findUserByIdentifier = (identifier) => {
  const normalized = String(identifier || "").trim().toLowerCase();
  return mockUsers.find(
    (u) =>
      u.username.toLowerCase() === normalized ||
      u.email.toLowerCase() === normalized
  );
};

const login = async ({ username, email, password }) => {
  const identifier = username || email;
  const user = findUserByIdentifier(identifier);

  if (!user || user.password !== password) return null;

  const safeUser = sanitizeUser(user);
  const token = createAuthToken(safeUser);

  return { token, user: safeUser };
};

module.exports = { login };