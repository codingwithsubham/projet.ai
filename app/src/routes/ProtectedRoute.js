import React from "react";
import { Navigate } from "react-router-dom";
import { getAuthToken } from "../services/auth.storage";

const ProtectedRoute = ({ children }) => {
  const token = getAuthToken();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;