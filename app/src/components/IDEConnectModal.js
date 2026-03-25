import React, { useState } from "react";

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

const IDEConnectModal = ({ isOpen, onClose, projectName, apiKey }) => {
  const [selectedIDE, setSelectedIDE] = useState("vscode");
  const [copied, setCopied] = useState(false);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfig);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

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
                      <button className="code-block__copy" onClick={handleCopy}>
                        {copied ? "✓ Copied!" : "📋 Copy"}
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

              <div className="ide-instructions__step">
                <span className="step-number">4</span>
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
                💡 <strong>Tip:</strong> Once connected, you can ask your AI assistant about this project's codebase,
                generate documents, and more!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDEConnectModal;
