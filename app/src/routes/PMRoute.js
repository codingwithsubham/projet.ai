import React from "react";
import { Navigate } from "react-router-dom";
import { getAuthToken, getAuthUser } from "../services/auth.storage";

const PMRoute = ({ children }) => {
  const token = getAuthToken();
  const user = getAuthUser();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const userRole = String(user?.role || "");
  // Allow both PM and admin users
  if (userRole !== "PM" && userRole !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PMRoute;
