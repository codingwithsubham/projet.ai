import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "";

export const loginApi = async ({ username, password }) => {
  const response = await axios.post(`${API_BASE}/api/v1/auth/login`, {
    username,
    password,
  });
  return response.data;
};