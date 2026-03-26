import React, { useCallback, useEffect, useState } from "react";
import { getCopilotConfigApi } from "../../services/activity.api";

const CopilotConfig = ({ projectId, projectName }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const fetchConfig = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError("");
    
    try {
      const response = await getCopilotConfigApi(projectId, "full");
      setConfig(response?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to fetch config");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const downloadFile = (content, filename) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!projectId) {
    return (
      <div className="copilot-config">
        <p className="copilot-config-empty">Select a project to generate Copilot configuration.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="copilot-config">
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="copilot-config">
        <p className="projects-error">{error}</p>
        <button type="button" className="projects-btn projects-btn--secondary" onClick={fetchConfig}>
          Retry
        </button>
      </div>
    );
  }

  if (!config) return null;

  const instructionsContent = config.files?.["copilot-instructions.md"]?.content || "";
  const mcpConfigJson = JSON.stringify(config.mcpConfig, null, 2);
  const vsCodeSettingsJson = JSON.stringify(config.vsCodeSettings, null, 2);

  return (
    <div className="copilot-config">
      <div className="copilot-config-header">
        <h3>VS Code Copilot Configuration</h3>
        <p>Configure GitHub Copilot to connect to the Knowledge Hub for {projectName || "this project"}.</p>
      </div>

      {/* Setup Instructions */}
      <div className="copilot-config-section">
        <h4>Setup Instructions</h4>
        <ol className="copilot-config-steps">
          {config.instructions?.setup?.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
        <p className="copilot-config-note">
          <strong>Note:</strong> {config.instructions?.apiKey}
        </p>
      </div>

      {/* MCP Configuration */}
      <div className="copilot-config-section">
        <div className="copilot-config-section-header">
          <h4>MCP Server Configuration</h4>
          <div className="copilot-config-actions">
            <button
              type="button"
              className="projects-btn projects-btn--tiny"
              onClick={() => copyToClipboard(mcpConfigJson, "mcp")}
            >
              {copied === "mcp" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <p className="copilot-config-desc">
          Add this to your VS Code <code>settings.json</code>:
        </p>
        <pre className="copilot-config-code">
          <code>{mcpConfigJson}</code>
        </pre>
      </div>

      {/* Full VS Code Settings */}
      <div className="copilot-config-section">
        <div className="copilot-config-section-header">
          <h4>Full VS Code Settings</h4>
          <div className="copilot-config-actions">
            <button
              type="button"
              className="projects-btn projects-btn--tiny"
              onClick={() => copyToClipboard(vsCodeSettingsJson, "vscode")}
            >
              {copied === "vscode" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <p className="copilot-config-desc">
          Complete settings including instruction file reference:
        </p>
        <pre className="copilot-config-code">
          <code>{vsCodeSettingsJson}</code>
        </pre>
      </div>

      {/* Copilot Instructions File */}
      <div className="copilot-config-section">
        <div className="copilot-config-section-header">
          <h4>copilot-instructions.md</h4>
          <div className="copilot-config-actions">
            <button
              type="button"
              className="projects-btn projects-btn--tiny"
              onClick={() => copyToClipboard(instructionsContent, "instructions")}
            >
              {copied === "instructions" ? "Copied!" : "Copy"}
            </button>
            <button
              type="button"
              className="projects-btn projects-btn--tiny projects-btn--secondary"
              onClick={() => downloadFile(instructionsContent, "copilot-instructions.md")}
            >
              Download
            </button>
          </div>
        </div>
        <p className="copilot-config-desc">
          Save this file to <code>.github/copilot-instructions.md</code> in your project:
        </p>
        <pre className="copilot-config-code copilot-config-code--large">
          <code>{instructionsContent}</code>
        </pre>
      </div>

      {/* Available Tools */}
      <div className="copilot-config-section">
        <h4>Available MCP Tools</h4>
        <div className="copilot-config-tools">
          <div className="copilot-config-tool">
            <strong>search_hub</strong>
            <p>Search the knowledge hub for project codes, documents, user stories, etc.</p>
          </div>
          <div className="copilot-config-tool">
            <strong>get_my_activity</strong>
            <p>Review what you've been working on recently.</p>
          </div>
          <div className="copilot-config-tool">
            <strong>get_team_activity</strong>
            <p>See what the team has been working on (PM/Admin only).</p>
          </div>
          <div className="copilot-config-tool">
            <strong>get_developer_context</strong>
            <p>Get context for taking over another developer's work.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopilotConfig;
