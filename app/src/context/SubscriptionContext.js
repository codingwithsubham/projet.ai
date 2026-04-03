import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { getSidebarAgents, getUserSubscriptions } from "../services/subscription.api";
import { getAuthToken } from "../services/auth.storage";

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const [sidebarAgents, setSidebarAgents] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setSidebarAgents([]);
      setSubscriptions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [sidebarRes, subsRes] = await Promise.all([
        getSidebarAgents(),
        getUserSubscriptions()
      ]);
      setSidebarAgents(sidebarRes.data.data || []);
      setSubscriptions(subsRes.data.data || []);
    } catch (err) {
      console.error("Failed to fetch subscriptions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Provide a refresh function for components to call after subscribe/unsubscribe
  const refreshSubscriptions = useCallback(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Check if user is subscribed to a specific agent
  const isSubscribed = useCallback((agentSlug) => {
    return subscriptions.some(s => s.agentSlug === agentSlug && s.status === 'active');
  }, [subscriptions]);

  return (
    <SubscriptionContext.Provider
      value={{
        sidebarAgents,
        subscriptions,
        loading,
        refreshSubscriptions,
        isSubscribed
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};

export default SubscriptionContext;
