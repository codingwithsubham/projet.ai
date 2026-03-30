import React, { useState, useEffect } from "react";
import { getCopilotConfigApi } from "../services/activity.api";

const IDE_OPTIONS = [
  { id: "vscode", name: "VS Code", icon: "💻" },
  { id: "cursor", name: "Cursor", icon: "🖱️" },
  { id: "windsurf", name: "Windsurf", icon: "🏄" },
];

const getIDEInstructions = (ideId) => {
  switch (ideId) {
    case "vscode":
      return {
        configFile: "mcp.json",
        folderPath: ".vscode",
        step2Title: "Create MCP config file",
        step2Desc: (
          <>
            Create a <code>.vscode</code> folder in your project root (if it doesn't exist), then create a file named <code>mcp.json</code> inside it.
          </>
        ),
        fullPath: ".vscode/mcp.json",
      };
    case "cursor":
      return {
        configFile: "mcp.json",
        folderPath: ".cursor",
        step2Title: "Create MCP config file",
        step2Desc: (
          <>
            Create a <code>.cursor</code> folder in your project root (if it doesn't exist), then create a file named <code>mcp.json</code> inside it.
          </>
        ),
        fullPath: ".cursor/mcp.json",
      };
    case "windsurf":
      return {
        configFile: "mcp_config.json",
        folderPath: "~/.codeium/windsurf",
        step2Title: "Locate or create MCP config file",
        step2Desc: (
          <>
            Open or create the config file at:
            <div className="config-paths" style={{ marginTop: 8 }}>
              <div className="config-path">
                <span className="config-path__os">Windows:</span>
                <code>%USERPROFILE%\.codeium\windsurf\mcp_config.json</code>
              </div>
              <div className="config-path">
                <span className="config-path__os">macOS/Linux:</span>
                <code>~/.codeium/windsurf/mcp_config.json</code>
              </div>
            </div>
          </>
        ),
        fullPath: "~/.codeium/windsurf/mcp_config.json",
      };
    default:
      return {};
  }
};

const IDEConnectModal = ({ isOpen, onClose, projectName, projectId, apiKey }) => {
  const [selectedIDE, setSelectedIDE] = useState("vscode");
  const [copied, setCopied] = useState("");
  const [copilotConfig, setCopilotConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    if (isOpen && projectId && selectedIDE === "vscode") {
      setLoadingConfig(true);
      getCopilotConfigApi(projectId, "full")
        .then((res) => setCopilotConfig(res?.data || null))
        .catch((err) => console.error("Failed to load copilot config:", err))
        .finally(() => setLoadingConfig(false));
    }
  }, [isOpen, projectId, selectedIDE]);

  if (!isOpen) return null;

  const safeName = (projectName || "project").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  const ideInstructions = getIDEInstructions(selectedIDE);

  const mcpConfig = `{
  "servers": {
    "pro-jet-${safeName}": {
      "type": "sse",
      "url": "${process.env.REACT_APP_API_URL}/api/mcp/sse",
      "headers": {
        "x-api-key": "${apiKey || "YOUR_API_KEY_HERE"}"
      }
    }
  }
}`;

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = (content, filename) => {
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

  const instructionsContent = copilotConfig?.files?.["copilot-instructions.md"]?.content || "";
  const agentContent = copilotConfig?.files?.["projetai-dev.md"]?.content || "";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ide-connect-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ide-connect-modal__header">
          <h2>🔌 Connect to Your IDE</h2>
          <button className="ide-connect-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="ide-connect-modal__content">
          {/* Left Pane - IDE Selection */}
          <div className="ide-connect-modal__left">
            <h4>Select Your IDE</h4>
            <div className="ide-list">
              {IDE_OPTIONS.map((ide) => (
                <button
                  key={ide.id}
                  className={`ide-list__item ${selectedIDE === ide.id ? "ide-list__item--active" : ""}`}
                  onClick={() => setSelectedIDE(ide.id)}
                >
                  <span className="ide-list__icon">{ide.icon}</span>
                  <span className="ide-list__name">{ide.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Pane - Instructions */}
          <div className="ide-connect-modal__right">
            <h4>Setup Instructions for {IDE_OPTIONS.find((i) => i.id === selectedIDE)?.name}</h4>

            <div className="ide-instructions">
              <div className="ide-instructions__step">
                <span className="step-number">1</span>
                <div className="step-content">
                  <strong>Get your API Key from Admin</strong>
                  <p>
                    Contact your project admin to get an API key, or if you're an admin, go to <strong>API Keys</strong> in the sidebar to create one.
                  </p>
                </div>
              </div>

              <div className="ide-instructions__step">
                <span className="step-number">2</span>
                <div className="step-content">
                  <strong>{ideInstructions.step2Title}</strong>
                  <p>{ideInstructions.step2Desc}</p>
                  {selectedIDE !== "windsurf" && (
                    <div className="file-path-hint">
                      <code>{ideInstructions.fullPath}</code>
                    </div>
                  )}
                </div>
              </div>

              <div className="ide-instructions__step">
                <span className="step-number">3</span>
                <div className="step-content">
                  <strong>Add the MCP server configuration</strong>
                  <p>Copy and paste this configuration into your <code>{ideInstructions.configFile}</code> file:</p>
                  <div className="code-block">
                    <div className="code-block__header">
                      <span>{ideInstructions.configFile}</span>
                      <button className="code-block__copy" onClick={() => handleCopy(mcpConfig, "mcp")}>
                        {copied === "mcp" ? "✓ Copied!" : "📋 Copy"}
                      </button>
                    </div>
                    <pre className="code-block__content">{mcpConfig}</pre>
                  </div>
                  {!apiKey && (
                    <p className="ide-instructions__warning">
                      ⚠️ Replace <code>YOUR_API_KEY_HERE</code> with your actual API key.
                    </p>
                  )}
                </div>
              </div>

              {selectedIDE === "vscode" && (
                <div className="ide-instructions__step">
                  <span className="step-number">4</span>
                  <div className="step-content">
                    <strong>Add Copilot Instructions (Optional)</strong>
                    <p>Download and add this file to <code>.github/copilot-instructions.md</code> in your project to customize Copilot behavior:</p>
                    {loadingConfig ? (
                      <p className="kb-muted">Loading config...</p>
                    ) : instructionsContent ? (
                      <div className="code-block">
                        <div className="code-block__header">
                          <span>copilot-instructions.md</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="code-block__copy" onClick={() => handleCopy(instructionsContent, "instructions")}>
                              {copied === "instructions" ? "✓ Copied!" : "📋 Copy"}
                            </button>
                            <button className="code-block__copy" onClick={() => handleDownload(instructionsContent, "copilot-instructions.md")}>
                              ⬇️ Download
                            </button>
                          </div>
                        </div>
                        <pre className="code-block__content" style={{ maxHeight: 200, overflow: "auto" }}>{instructionsContent}</pre>
                      </div>
                    ) : (
                      <p className="kb-muted">Could not load instructions file.</p>
                    )}
                  </div>
                </div>
              )}

              {selectedIDE === "vscode" && (
                <div className="ide-instructions__step">
                  <span className="step-number">5</span>
                  <div className="step-content">
                    <strong>Add Custom Dev Agent (Recommended)</strong>
                    <p>
                      Download and place this file at <code>.github/agents/projetai-dev.md</code> in your project.
                      This creates a custom <strong>@projetai-dev</strong> agent in Copilot Chat that is pre-configured to search your Knowledge Hub.
                    </p>
                    {loadingConfig ? (
                      <p className="kb-muted">Loading config...</p>
                    ) : agentContent ? (
                      <div className="code-block">
                        <div className="code-block__header">
                          <span>projetai-dev.md</span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="code-block__copy" onClick={() => handleCopy(agentContent, "agent")}>
                              {copied === "agent" ? "✓ Copied!" : "📋 Copy"}
                            </button>
                            <button className="code-block__copy" onClick={() => handleDownload(agentContent, "projetai-dev.md")}>
                              ⬇️ Download
                            </button>
                          </div>
                        </div>
                        <pre className="code-block__content" style={{ maxHeight: 200, overflow: "auto" }}>{agentContent}</pre>
                      </div>
                    ) : (
                      <p className="kb-muted">Could not load agent file.</p>
                    )}
                    <div className="ide-agent-usage">
                      <p style={{ marginTop: 10, fontSize: 13 }}>
                        <strong>How to use:</strong> Type <code>@projetai-dev</code> in Copilot Chat, then ask your question:
                      </p>
                      <ul style={{ fontSize: 13, color: "#555", margin: "6px 0", paddingLeft: 20 }}>
                        <li><code>@projetai-dev</code> Show me user stories for the checkout module</li>
                        <li><code>@projetai-dev</code> How does authentication work in our app?</li>
                        <li><code>@projetai-dev</code> What was I working on last week?</li>
                        <li><code>@projetai-dev</code> Get handoff context for Ananya</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="ide-instructions__step">
                <span className="step-number">{selectedIDE === "vscode" ? "6" : "4"}</span>
                <div className="step-content">
                  <strong>Restart your IDE</strong>
                  <p>
                    After saving the configuration, restart {IDE_OPTIONS.find((i) => i.id === selectedIDE)?.name} to
                    connect to Pro-jet.ai MCP server.
                  </p>
                </div>
              </div>
            </div>

            <div className="ide-instructions__footer">
              <p>
                💡 <strong>Tip:</strong> Once connected, use <code>@projetai-dev</code> in Copilot Chat to query your project's Knowledge Hub — search user stories, browse codebase, get handoff context, and more!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDEConnectModal;
