import React from "react";
import { Navigate } from "react-router-dom";
import { getAuthToken } from "../services/auth.storage";

const PublicRoute = ({ children }) => {
  const token = getAuthToken();

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PublicRoute;