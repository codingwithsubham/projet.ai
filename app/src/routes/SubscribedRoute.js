import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken } from "../services/auth.storage";
import { checkSubscription } from "../services/subscription.api";

/**
 * Route-to-agent mapping
 */
const ROUTE_TO_AGENT = {
  "/documents": "doc-agent",
  "/presentations": "ppt-agent",
};

/**
 * Get agent slug from current path
 */
const getAgentSlugFromPath = (pathname) => {
  // Check exact match first
  if (ROUTE_TO_AGENT[pathname]) {
    return ROUTE_TO_AGENT[pathname];
  }
  // Check if path starts with any known route
  for (const [route, slug] of Object.entries(ROUTE_TO_AGENT)) {
    if (pathname.startsWith(route)) {
      return slug;
    }
  }
  return null;
};

/**
 * SubscribedRoute - Guards routes that require agent subscription
 * Shows loading state while checking subscription, then renders or redirects
 */
const SubscribedRoute = ({ children }) => {
  const token = getAuthToken();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState(null);

  const agentSlug = getAgentSlugFromPath(location.pathname);

  useEffect(() => {
    const checkAccess = async () => {
      if (!agentSlug) {
        // No subscription required for this route
        setIsSubscribed(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await checkSubscription(agentSlug);
        setIsSubscribed(res.data.data.isSubscribed);
      } catch (err) {
        console.error("Subscription check failed:", err);
        // If check fails with 403, user is not subscribed
        if (err.response?.status === 403) {
          setIsSubscribed(false);
        } else {
          setError("Failed to verify access");
        }
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [agentSlug]);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="subscription-check-loading">
        <p>Verifying access...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-check-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!isSubscribed) {
    // Redirect to marketplace with a message
    return (
      <Navigate 
        to="/marketplace" 
        replace 
        state={{ 
          message: `Please subscribe to access this feature`,
          requiredAgent: agentSlug 
        }} 
      />
    );
  }

  return children;
};

export default SubscribedRoute;
