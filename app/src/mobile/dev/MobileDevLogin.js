import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi } from "../../services/auth.api";
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  saveAuthSession,
} from "../../services/auth.storage";

const isDevUser = (user) => String(user?.role || "").toLowerCase() === "dev";

const MobileDevLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    const user = getAuthUser();

    if (!token || !user) return;

    if (isDevUser(user)) {
      navigate("/mob/projects", { replace: true });
      return;
    }

    clearAuthSession();
    setError("Mobile portal is available only for users with dev role.");
  }, [navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.username.trim() || !formData.password.trim()) {
      setError("Username and password are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await loginApi({
        username: formData.username.trim(),
        password: formData.password,
      });

      const authData = response?.data;
      if (!authData?.token || !authData?.user) {
        throw new Error("Invalid login response");
      }

      saveAuthSession(authData.token, authData.user);

      if (!isDevUser(authData.user)) {
        clearAuthSession();
        setError("Mobile portal is available only for users with dev role.");
        return;
      }

      navigate("/mob/projects", { replace: true });
    } catch (nextError) {
      const message =
        nextError?.response?.data?.message ||
        nextError?.message ||
        "Login failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mob-shell mob-shell--login">
      <div className="mob-login-hero">
        <p className="mob-login-badge">
          <span aria-hidden="true">🤖</span>
          AI Developer Portal
        </p>
        <h1 className="mob-title">Pro-jet.ai 🚀</h1>
        <p className="mob-subtitle mob-subtitle--hero">
          Next-gen mobile workspace for developers.
        </p>
        <div className="mob-login-chips" aria-hidden="true">
          <span className="mob-login-chip">🧠 Smart Context</span>
          <span className="mob-login-chip">⚡ Fast Chat</span>
          <span className="mob-login-chip">🔐 Secure Access</span>
        </div>
      </div>
      <div className="mob-card mob-login-card mob-login-card--nextgen">
        <br/>
        <form className="mob-form mob-form--nextgen" onSubmit={handleSubmit}>
          <label htmlFor="username">Username / Email</label>
          <div className="mob-input-wrap">
            <span className="mob-input-icon" aria-hidden="true">
              👤
            </span>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
              placeholder="john@aidlc.dev"
            />
          </div>

          <label htmlFor="password">Password</label>
          <div className="mob-input-wrap">
            <span className="mob-input-icon" aria-hidden="true">
              🔑
            </span>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
          </div>

          {error ? <p className="mob-error">{error}</p> : null}

          <button
            type="submit"
            className="mob-btn mob-btn--login"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Authenticating..." : "Continue to Dev Space"}
          </button>
        </form>
         <br/>
      </div>
    </section>
  );
};

export default MobileDevLogin;
