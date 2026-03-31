import React, { useEffect, useRef, useCallback } from "react";
import { useProjectChat } from "../../hooks/useProjectChat";
import ImplementationProgressCard, {
  getIsInProgressMessage,
} from "./ImplementationProgressCard";
import MarkdownMessage from "./MarkdownMessage";
import ThinkingLoader from "./ThinkingLoader";

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SidebarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

const NewChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const formatSessionDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const groupSessionsByDate = (sessions) => {
  const groups = {};
  sessions.forEach((s) => {
    const label = formatSessionDate(s.updatedAt || s.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  });
  return groups;
};

const ChatPanel = ({ projectId, projects = [], onProjectChange }) => {
  const streamRef = useRef(null);
  const streamBottomRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollRafRef = useRef(null);

  const {
    messages,
    sessions,
    activeSessionId,
    input,
    setInput,
    loadingHistory,
    sending,
    error,
    historyOpen,
    setHistoryOpen,
    sendMessage,
    openSession,
    newChat,
    deleteSession,
    refreshActiveSession,
    streamStatus,
  } = useProjectChat(projectId);

  // Throttled auto-scroll via requestAnimationFrame (prevents flicker)
  useEffect(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      const el = streamRef.current;
      if (!el) return;
      // Always auto-scroll while streaming/sending; otherwise only if near bottom
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 400;
      if (sending || isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    });
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [messages, sending, loadingHistory, activeSessionId]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 150) + "px";
  }, [setInput]);

  const onSubmit = async (e) => {
    e.preventDefault();
    await sendMessage();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const onTextareaKeyDown = async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleDeleteSession = (e, sessionId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this chat?")) {
      deleteSession(sessionId);
    }
  };

  const groupedSessions = groupSessionsByDate(sessions);
  const hasMessages = messages.length > 0;
  const selectedProject = projects.find((p) => p._id === projectId);

  // Input bar component (shared between hero & chat views)
  const inputBar = (
    <form className="chat-input-row" onSubmit={onSubmit}>
      <div className="chat-input-wrap">
        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onTextareaKeyDown}
            placeholder="Ask anything..."
            rows={1}
            disabled={!projectId}
          />
          <div className="chat-input-actions">
            <div className="chat-input-project-toggle">
              <select
                value={projectId || ""}
                onChange={(e) => onProjectChange?.(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="chat-send-btn" disabled={sending || !input.trim() || !projectId}>
              {sending ? <span className="chat-send-btn__spinner" /> : <SendIcon />}
            </button>
          </div>
        </div>
        <span className="chat-input-hint">Shift + Enter for new line</span>
      </div>
    </form>
  );

  return (
    <div className={`chat-layout ${historyOpen ? "chat-layout--open" : ""}`}>
      {/* ─── Sidebar ─── */}
      <aside className={`chat-sidebar ${historyOpen ? "chat-sidebar--open" : ""}`}>
        <div className="chat-sidebar__head">
          <button
            type="button"
            className="chat-sidebar__toggle"
            onClick={() => setHistoryOpen(false)}
            title="Close sidebar"
          >
            <SidebarIcon />
          </button>
          <button type="button" className="chat-sidebar__new" onClick={newChat} title="New chat">
            <NewChatIcon />
          </button>
        </div>

        <div className="chat-sidebar__list">
          {sessions.length ? (
            Object.entries(groupedSessions).map(([label, group]) => (
              <div key={label} className="chat-sidebar__group">
                <div className="chat-sidebar__group-label">{label}</div>
                {group.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    className={`chat-sidebar__item ${activeSessionId === s._id ? "chat-sidebar__item--active" : ""}`}
                    onClick={() => openSession(s._id)}
                  >
                    <span className="chat-sidebar__item-text">{s.title || "New Chat"}</span>
                    <button
                      type="button"
                      className="chat-sidebar__delete"
                      onClick={(e) => handleDeleteSession(e, s._id)}
                      title="Delete chat"
                      aria-label="Delete chat"
                    >
                      ✕
                    </button>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <p className="chat-sidebar__empty">No chats yet</p>
          )}
        </div>
      </aside>

      {/* ─── Main ─── */}
      <section className="chat-main">
        {/* Top bar — only sidebar toggle + project name */}
        <div className="chat-topbar">
          {!historyOpen && (
            <button
              type="button"
              className="chat-topbar__toggle"
              onClick={() => setHistoryOpen(true)}
              title="Open sidebar"
            >
              <SidebarIcon />
            </button>
          )}
          {!historyOpen && (
            <button type="button" className="chat-topbar__new" onClick={newChat} title="New chat">
              <NewChatIcon />
            </button>
          )}
          <span className="chat-topbar__project-name">
            {selectedProject?.name || ""}
          </span>
        </div>

        {/* Empty / Hero state (no messages) */}
        {!hasMessages && !loadingHistory ? (
          <div className="chat-hero-center">
            <div className="chat-empty-hero">
              <div className="chat-empty-hero__icon">
                <span className="chat-empty-hero__sparkle">✦</span>
              </div>
              <h2 className="chat-empty-hero__title">Pro-jet.ai Agent</h2>
              <p className="chat-empty-hero__subtitle">
                Your AI project manager. Ask about Jira, documents, presentations, or your knowledge base.
              </p>
              <div className="chat-empty-hero__capabilities">
                <div className="chat-empty-hero__cap-item">
                  <span>📋</span><span>Jira &amp; Backlog</span>
                </div>
                <div className="chat-empty-hero__cap-item">
                  <span>📄</span><span>Documents</span>
                </div>
                <div className="chat-empty-hero__cap-item">
                  <span>📊</span><span>Presentations</span>
                </div>
                <div className="chat-empty-hero__cap-item">
                  <span>🧠</span><span>Knowledge Base</span>
                </div>
              </div>
            </div>
            {inputBar}
          </div>
        ) : (
          <>
            {/* Messages stream */}
            <div className="chat-stream" ref={streamRef}>
              {loadingHistory ? <p className="kb-muted">Loading history...</p> : null}
              {error ? <p className="projects-error">{error}</p> : null}

              {messages.map((m, idx) => {
                const isInProgressAssistantMessage =
                  m.role === "assistant" && getIsInProgressMessage(m.content);
                const isLastMessage = idx === messages.length - 1;
                const isStreamingMsg = m._id === "__streaming__";
                if (isInProgressAssistantMessage && !isLastMessage) return null;

                return (
                  <div key={m._id || idx} className={`chat-message chat-message--${m.role} chat-message--enter`}>
                    <div className={`chat-avatar chat-avatar--${m.role}`} aria-hidden="true">
                      {m.role === "assistant"
                        ? <span className="chat-avatar__ai-icon">✦</span>
                        : <span className="chat-avatar__user-icon">U</span>
                      }
                    </div>
                    <article className={`chat-bubble chat-bubble--${m.role}`}>
                      {isInProgressAssistantMessage ? (
                        <ImplementationProgressCard
                          content={m.content || ""}
                          onRefresh={refreshActiveSession}
                          refreshing={loadingHistory}
                        />
                      ) : m.role === "assistant" ? (
                        <MarkdownMessage content={m.content || ""} streaming={isStreamingMsg} />
                      ) : (
                        <p>{m.content}</p>
                      )}
                    </article>
                  </div>
                );
              })}

              {sending && !messages.some((m) => m._id === "__streaming__") && (
                <div className="chat-message chat-message--assistant chat-message--enter">
                  <div className="chat-avatar chat-avatar--assistant" aria-hidden="true">
                    <span className="chat-avatar__ai-icon">✦</span>
                  </div>
                  <article className="chat-bubble chat-bubble--assistant" aria-live="polite">
                    <ThinkingLoader statusText={streamStatus} />
                  </article>
                </div>
              )}

              <div ref={streamBottomRef} />
            </div>

            {inputBar}
          </>
        )}
      </section>
    </div>
  );
};

export default ChatPanel;