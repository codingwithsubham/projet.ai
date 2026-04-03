import React, { useEffect, useState, useCallback } from "react";
import {
  getMarketplaceAgents,
  getUserSubscriptions,
  subscribeToAgent,
  unsubscribeFromAgent,
  getSubscriptionHistory,
} from "../../services/subscription.api";
import { useSubscription } from "../../context/SubscriptionContext";

// SVG Icons for agents
const AgentIcons = {
  'doc-agent': (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
  'ppt-agent': (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
      <path d="M6 7h.01M9 7h9"></path>
      <path d="M6 11h.01M9 11h9"></path>
    </svg>
  ),
  'default': (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  )
};

const getAgentIcon = (slug) => AgentIcons[slug] || AgentIcons['default'];

// Icon colors based on agent type
const ICON_COLORS = {
  'doc-agent': { bg: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)', color: '#fff' },
  'ppt-agent': { bg: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', color: '#fff' },
  'default': { bg: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff' }
};

const getIconStyle = (slug) => ICON_COLORS[slug] || ICON_COLORS['default'];

const CATEGORY_LABELS = {
  common: "Common",
  productivity: "Productivity",
  quality: "Quality",
  analytics: "Analytics",
  experimental: "Experimental",
};

const STATUS_LABELS = {
  active: "Available",
  "coming-soon": "Coming Soon",
  beta: "Beta",
  deprecated: "Deprecated",
};

const MarketplacePage = () => {
  const { refreshSubscriptions } = useSubscription();
  const [agents, setAgents] = useState([]);
  const [subscriptions, setSubscriptions] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("marketplace");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [agentsRes, subsRes] = await Promise.all([
        getMarketplaceAgents(),
        getUserSubscriptions(),
      ]);

      setAgents(agentsRes.data.data || []);

      // Convert subscriptions array to a map for easy lookup
      const subsMap = {};
      (subsRes.data.data || []).forEach((sub) => {
        subsMap[sub.agentSlug] = sub;
      });
      setSubscriptions(subsMap);
    } catch (err) {
      console.error("Failed to fetch marketplace data:", err);
      setError("Failed to load marketplace. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await getSubscriptionHistory();
      setHistory(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const handleSubscribe = async (slug) => {
    try {
      setActionLoading((prev) => ({ ...prev, [slug]: true }));
      await subscribeToAgent(slug);
      await fetchData();
      // Refresh global subscription state to update sidebar
      refreshSubscriptions();
    } catch (err) {
      console.error("Subscribe failed:", err);
      alert(err.response?.data?.error || "Failed to subscribe");
    } finally {
      setActionLoading((prev) => ({ ...prev, [slug]: false }));
    }
  };

  const handleUnsubscribe = async (slug) => {
    try {
      setActionLoading((prev) => ({ ...prev, [slug]: true }));
      await unsubscribeFromAgent(slug);
      await fetchData();
      // Refresh global subscription state to update sidebar
      refreshSubscriptions();
    } catch (err) {
      console.error("Unsubscribe failed:", err);
      alert(err.response?.data?.error || "Failed to unsubscribe");
    } finally {
      setActionLoading((prev) => ({ ...prev, [slug]: false }));
    }
  };

  const filteredAgents =
    categoryFilter === "all"
      ? agents
      : agents.filter((a) => a.category === categoryFilter);

  const categories = ["all", ...new Set(agents.map((a) => a.category))];

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="marketplace-page">
        <div className="marketplace-loading">
          <div className="spinner"></div>
          <p>Loading marketplace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="marketplace-page">
        <div className="marketplace-error">
          <p>{error}</p>
          <button onClick={fetchData} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-page">
      {/* Hero Banner */}
      <div className="marketplace-banner">
        <div className="banner-content">
          <h1>Agent <span>Marketplace</span></h1>
          <p className="page-subtitle">
            Extend your workspace with powerful AI agents. Install specialized tools to boost your productivity.
          </p>
          <div className="banner-stats">
            <div className="banner-stat">
              <span className="banner-stat-value">{agents.length}</span>
              <span className="banner-stat-label">Available Agents</span>
            </div>
            <div className="banner-stat">
              <span className="banner-stat-value">{Object.keys(subscriptions).length}</span>
              <span className="banner-stat-label">Installed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="marketplace-content">
        {/* Tabs */}
        <div className="marketplace-tabs">
          <button
            className={`tab-btn ${activeTab === "marketplace" ? "active" : ""}`}
            onClick={() => setActiveTab("marketplace")}
          >
            Browse Agents
          </button>
          <button
            className={`tab-btn ${activeTab === "installed" ? "active" : ""}`}
            onClick={() => setActiveTab("installed")}
          >
            My Agents ({Object.keys(subscriptions).length})
          </button>
          <button
            className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </div>

      {/* Marketplace Tab */}
      {activeTab === "marketplace" && (
        <>
          {/* Category Filter */}
          <div className="category-filter">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-btn ${categoryFilter === cat ? "active" : ""}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === "all" ? "All" : CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          {/* Agent Grid */}
          <div className="agent-grid">
            {filteredAgents.map((agent) => {
              const isSubscribed = !!subscriptions[agent.slug];
              const isLoading = actionLoading[agent.slug];
              const isAvailable = agent.status === "active";
              const iconStyle = getIconStyle(agent.slug);

              return (
                <div key={agent.slug} className={`agent-card ${isSubscribed ? 'installed' : ''}`}>
                  <div className="agent-card__header">
                    <div 
                      className="agent-icon" 
                      style={{ background: iconStyle.bg, color: iconStyle.color }}
                    >
                      {getAgentIcon(agent.slug)}
                    </div>
                    <div className="agent-meta">
                      <h3 className="agent-name">{agent.name}</h3>
                      <span className={`status-badge status-${agent.status}`}>
                        {STATUS_LABELS[agent.status]}
                      </span>
                    </div>
                  </div>

                  <p className="agent-description">{agent.description}</p>

                  {agent.features && agent.features.length > 0 && (
                    <ul className="agent-features">
                      {agent.features.slice(0, 4).map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  )}

                  <div className="agent-card__footer">
                    <span className="category-tag">
                      {CATEGORY_LABELS[agent.category] || agent.category}
                    </span>
                    <span className="version-tag">v{agent.version}</span>
                  </div>

                  <div className="agent-card__actions">
                    {isSubscribed ? (
                      <button
                        className="btn btn-outline-danger"
                        onClick={() => handleUnsubscribe(agent.slug)}
                        disabled={isLoading}
                      >
                        {isLoading ? "Removing..." : "Uninstall"}
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleSubscribe(agent.slug)}
                        disabled={isLoading || !isAvailable}
                      >
                        {isLoading
                          ? "Installing..."
                          : !isAvailable
                            ? "Coming Soon"
                            : "Install"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredAgents.length === 0 && (
            <div className="empty-state">
              <p>No agents found in this category.</p>
            </div>
          )}
        </>
      )}

      {/* Installed Tab */}
      {activeTab === "installed" && (
        <div className="installed-agents">
          {Object.keys(subscriptions).length === 0 ? (
            <div className="empty-state">
              <p>You haven't installed any agents yet.</p>
              <button
                className="btn btn-primary"
                onClick={() => setActiveTab("marketplace")}
              >
                Browse Marketplace
              </button>
            </div>
          ) : (
            <div className="agent-grid">
              {Object.values(subscriptions).map((sub) => {
                const agent = sub.agent || {};
                const isLoading = actionLoading[sub.agentSlug];
                const iconStyle = getIconStyle(sub.agentSlug);

                return (
                  <div key={sub.agentSlug} className="agent-card installed">
                    <div className="agent-card__header">
                      <div 
                        className="agent-icon" 
                        style={{ background: iconStyle.bg, color: iconStyle.color }}
                      >
                        {getAgentIcon(sub.agentSlug)}
                      </div>
                      <div className="agent-meta">
                        <h3 className="agent-name">
                          {agent.name || sub.agentSlug}
                        </h3>
                        <span className="installed-badge">✓ Installed</span>
                      </div>
                    </div>

                    <p className="agent-description">
                      {agent.description || "Agent details unavailable"}
                    </p>

                    <div className="agent-card__footer">
                      <span className="install-date">
                        Installed: {formatDate(sub.subscribedAt)}
                      </span>
                    </div>

                    <div className="agent-card__actions">
                      <button
                        className="btn btn-outline-danger"
                        onClick={() => handleUnsubscribe(sub.agentSlug)}
                        disabled={isLoading}
                      >
                        {isLoading ? "Removing..." : "Uninstall"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="subscription-history">
          {history.length === 0 ? (
            <div className="empty-state">
              <p>No subscription history yet.</p>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Action</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, idx) => {
                  const iconStyle = getIconStyle(entry.agentSlug);
                  return (
                    <tr key={idx}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div 
                          className="agent-icon-small" 
                          style={{ background: iconStyle.bg, color: iconStyle.color }}
                        >
                          {getAgentIcon(entry.agentSlug)}
                        </div>
                        {entry.agentName}
                      </td>
                      <td>
                        <span className={`action-badge action-${entry.action}`}>
                          {entry.action === "subscribe" ? "Installed" : "Uninstalled"}
                        </span>
                      </td>
                      <td>{formatDate(entry.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      </div>
    </div>
  );
};

export default MarketplacePage;
