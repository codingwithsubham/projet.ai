import React from "react";
import { Navigate } from "react-router-dom";
import { getAuthToken, getAuthUser } from "../services/auth.storage";

const AdminRoute = ({ children }) => {
  const token = getAuthToken();
  const user = getAuthUser();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (String(user?.role || "") !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
