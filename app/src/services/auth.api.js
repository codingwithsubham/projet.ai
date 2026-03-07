import apiClient from "./apiClient";

export const loginApi = async ({ username, password }) => {
  const response = await apiClient.post(
    "/auth/login",
    {
      username,
      password,
    },
    { skipAuth: true }
  );
  return response.data;
};

export const verifyTokenApi = async () => {
  const response = await apiClient.post("/auth/verify");
  return response.data;
};