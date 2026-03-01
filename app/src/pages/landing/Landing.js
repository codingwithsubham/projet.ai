import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const Landing = () => {
  const navigate = useNavigate();
  const {
    formData,
    submittedData,
    errors,
    isSubmitting,
    user,
    isAuthenticated,
    handleChange,
    handleSubmit,
    logout,
  } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onLoginSubmit = async (e) => {
    const result = await handleSubmit(e);
    if (result?.ok) {
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="landing-card">
      <aside className="landing-left">
        <div className="brand-wrap">
          <h1>Pro-jet.ai 🚀</h1>
          <p>
            Manage your <b>Projects</b> with the power of <b>AI Agents</b>
            <br />
            SDLC turnes into <b>Ai-DLC</b>, the future of software development
            is here
            <br />
          </p>
        </div>
      </aside>

      <main className="landing-right">
        <div className="auth-card">
          <h2>{isAuthenticated ? "Welcome" : "Sign in"}</h2>

          {!isAuthenticated ? (
            <>
              <p className="subtitle">
                Don&apos;t have an account? <a href="#signup">Sign Up</a>
              </p>

              <form onSubmit={onLoginSubmit}>
                <label htmlFor="email">Username / Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && <p className="subtitle">{errors.email}</p>}

                <div className="label-row">
                  <label htmlFor="password">Password</label>
                  <a href="#forgot">Forgot Password?</a>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                />
                {errors.password && <p className="subtitle">{errors.password}</p>}
                {errors.form && <p className="subtitle">{errors.form}</p>}

                <label className="remember">
                  <input
                    name="remember"
                    type="checkbox"
                    checked={formData.remember}
                    onChange={handleChange}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="submit"
                  className="login-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Logging in..." : "Login"}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="subtitle">
                Logged in as <b>{user?.name || user?.username}</b>
              </p>
              <button type="button" className="login-btn" onClick={logout}>
                Logout
              </button>
            </>
          )}

          {submittedData && !errors.form && (
            <p className="subtitle" style={{ marginTop: "12px" }}>
              Captured: {submittedData.email} | Remember:{" "}
              {submittedData.remember ? "Yes" : "No"}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Landing;