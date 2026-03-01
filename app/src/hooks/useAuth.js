import { useState, useCallback } from "react";
import { loginApi } from "../services/auth.api";
import {
  saveAuthSession,
  getAuthToken,
  getAuthUser,
  clearAuthSession,
} from "../services/auth.storage";

const initialState = {
  email: "",
  password: "",
  remember: false,
};

export const useAuth = (onSubmit) => {
  const [formData, setFormData] = useState(initialState);
  const [submittedData, setSubmittedData] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState(() => getAuthUser());

  const validate = useCallback((data) => {
    const nextErrors = {};
    if (!data.email?.trim()) nextErrors.email = "Username/Email is required";
    if (!data.password?.trim()) nextErrors.password = "Password is required";
    return nextErrors;
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
  }, []);

  const defaultSubmit = useCallback(async (data) => {
    return await loginApi({
      username: data.email,
      password: data.password,
    });
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const nextErrors = validate(formData);

      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        return { ok: false, errors: nextErrors };
      }

      setIsSubmitting(true);
      try {
        const response = await (onSubmit ? onSubmit(formData) : defaultSubmit(formData));
        const authData = response?.data;

        if (!authData?.token) {
          throw new Error("Invalid login response");
        }

        setSubmittedData(formData);
        setToken(authData.token);
        setUser(authData.user);
        saveAuthSession(authData.token, authData.user);

        return { ok: true, data: authData };
      } catch (error) {
        const message =
          error?.response?.data?.message || error?.message || "Login failed";
        const formError = { form: message };
        setErrors((prev) => ({ ...prev, ...formError }));
        return { ok: false, errors: formError };
      } finally {
        setIsSubmitting(false);
      }
    },
    [defaultSubmit, formData, onSubmit, validate]
  );

  const logout = useCallback(() => {
    clearAuthSession();
    setToken(null);
    setUser(null);
    setSubmittedData(null);
  }, []);

  const reset = useCallback(() => {
    setFormData(initialState);
    setSubmittedData(null);
    setErrors({});
  }, []);

  return {
    formData,
    submittedData,
    errors,
    isSubmitting,
    token,
    user,
    isAuthenticated: Boolean(token),
    handleChange,
    handleSubmit,
    logout,
    reset,
  };
};