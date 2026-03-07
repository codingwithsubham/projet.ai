const { mockUsers } = require("../common/mockUsers");
const User = require("../models/UserModel");
const { createAuthToken, verifyAuthToken } = require("../helpers/tokenHelper");

const sanitizeUser = (user) => {
  const normalized = typeof user.toObject === "function" ? user.toObject() : user;
  const { password, ...safeUser } = normalized;
  return safeUser;
};

const findUserByIdentifier = async (identifier) => {
  const normalized = String(identifier || "").trim().toLowerCase();

  if (!normalized) return null;

  return await User.findOne({
    $or: [{ username: normalized }, { email: normalized }],
  });
};

const bootstrapUsers = async () => {
  const userCount = await User.estimatedDocumentCount();
  if (userCount > 0) return;

  const initialUsers = mockUsers.map((user) => ({
    username: String(user.username || "").trim().toLowerCase(),
    email: String(user.email || "").trim().toLowerCase(),
    password: user.password,
    role: user.role,
    name: user.name,
    projects: [],
  }));

  await User.insertMany(initialUsers);
};

const login = async ({ username, email, password }) => {
  const identifier = username || email;
  const user = await findUserByIdentifier(identifier);

  if (!user || user.password !== password) return null;

  const safeUser = sanitizeUser(user);
  const token = createAuthToken(safeUser);

  return { token, user: safeUser };
};

const verifyToken = async (token) => {
  const payload = verifyAuthToken(token);
  if (!payload) return null;

  const user = await User.findById(payload.sub);
  if (!user) return null;

  return {
    payload,
    user: sanitizeUser(user),
  };
};

module.exports = { login, verifyToken, bootstrapUsers };