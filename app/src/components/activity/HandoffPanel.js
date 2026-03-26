import React from "react";

const prettyDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const HandoffPanel = ({ context, onClose }) => {
  if (!context) return null;

  const { developer, period, totalActivities, topics, filesWorkedOn, recentPrompts } = context;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-wrapper handoff-modal">
        <div className="modal-card handoff-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Handoff Context - {developer?.name || "Developer"}</h3>
            <button type="button" className="modal-close" onClick={onClose}>
              X
            </button>
          </div>

          <div className="handoff-content">
            {/* Summary */}
            <div className="handoff-section">
              <div className="handoff-summary">
                <div className="handoff-stat">
                  <span className="handoff-stat-value">{totalActivities}</span>
                  <span className="handoff-stat-label">Interactions</span>
                </div>
                <div className="handoff-stat">
                  <span className="handoff-stat-value">{period?.days || 7}</span>
                  <span className="handoff-stat-label">Days</span>
                </div>
                <div className="handoff-stat">
                  <span className="handoff-stat-value">{topics?.length || 0}</span>
                  <span className="handoff-stat-label">Topics</span>
                </div>
                <div className="handoff-stat">
                  <span className="handoff-stat-value">{filesWorkedOn?.length || 0}</span>
                  <span className="handoff-stat-label">Files</span>
                </div>
              </div>
            </div>

            {/* Topics */}
            {topics && topics.length > 0 && (
              <div className="handoff-section">
                <h4>Topics Worked On</h4>
                <div className="handoff-tags">
                  {topics.slice(0, 15).map((topic, idx) => (
                    <span key={idx} className="handoff-tag">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {filesWorkedOn && filesWorkedOn.length > 0 && (
              <div className="handoff-section">
                <h4>Files Touched</h4>
                <ul className="handoff-files">
                  {filesWorkedOn.slice(0, 10).map((file, idx) => (
                    <li key={idx}>
                      <code>{file}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recent Prompts */}
            {recentPrompts && recentPrompts.length > 0 && (
              <div className="handoff-section">
                <h4>Recent Tasks/Questions</h4>
                <ul className="handoff-prompts">
                  {recentPrompts.slice(0, 10).map((p, idx) => (
                    <li key={idx}>
                      <span className="handoff-prompt-date">{prettyDate(p.createdAt)}</span>
                      <span className="handoff-prompt-agent">[{p.agentType}]</span>
                      <span className="handoff-prompt-text">
                        {p.summary || p.prompt?.slice(0, 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="handoff-actions">
              <button
                type="button"
                className="projects-btn projects-btn--secondary"
                onClick={() => {
                  const summary = `
Handoff Context for ${developer?.name}
=====================================
Period: Last ${period?.days} days
Total Interactions: ${totalActivities}

Topics:
${topics?.map(t => `- ${t}`).join('\n') || 'None'}

Files:
${filesWorkedOn?.map(f => `- ${f}`).join('\n') || 'None'}

Recent Tasks:
${recentPrompts?.map(p => `- [${prettyDate(p.createdAt)}] ${p.summary || p.prompt?.slice(0, 80)}`).join('\n') || 'None'}
                  `.trim();
                  navigator.clipboard.writeText(summary);
                  alert("Handoff context copied to clipboard!");
                }}
              >
                Copy Summary
              </button>
              <button type="button" className="projects-btn" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandoffPanel;
