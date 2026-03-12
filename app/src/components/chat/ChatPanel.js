import React, { useEffect, useRef } from "react";
import { useProjectChat } from "../../hooks/useProjectChat";
import PromptLibrary from "./PromptLibrary";
import ImplementationProgressCard, {
  getIsInProgressMessage,
} from "./ImplementationProgressCard";
import MarkdownMessage from "./MarkdownMessage";

const ChatPanel = ({ projectId }) => {
  const streamRef = useRef(null);
  const streamBottomRef = useRef(null);

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
    refreshActiveSession,
    showPromptLibrary,
    setShowPromptLibrary,
  } = useProjectChat(projectId);

  useEffect(() => {
    const streamElement = streamRef.current;
    if (!streamElement) return;
    streamElement.scrollTop = streamElement.scrollHeight;
    streamBottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, loadingHistory, activeSessionId]);

  const onSubmit = async (e) => {
    e.preventDefault();
    await sendMessage();
  };

  const onTextareaKeyDown = async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  };

  return (
    <div className={`chat-layout ${historyOpen ? "chat-layout--open" : ""}`}>
      <aside className={`chat-history ${historyOpen ? "is-open" : ""}`}>
        <div className="chat-history__head">
          <h3>Chats</h3>
          <button type="button" className="projects-btn projects-btn--tiny" onClick={newChat}>
            ✍🏻 New Chat
          </button>
        </div>

        <div className="chat-history__list">
          {sessions.length ? (
            sessions.map((s) => (
              <button
                key={s._id}
                type="button"
                className={`chat-history__item ${activeSessionId === s._id ? "chat-history__item--active" : ""}`}
                onClick={() => openSession(s._id)}
              >
                {s.title || "New Chat"}
              </button>
            ))
          ) : (
            <p className="kb-muted">No chats yet.</p>
          )}
        </div>
      </aside>

      <section className="chat-main">
        <div className="chat-main__head">
          <button
            type="button"
            className="projects-btn projects-btn--secondary projects-btn--tiny"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            {historyOpen ? "Collapse History" : "Show History"}
          </button>
        </div>

        <div className="chat-stream" ref={streamRef}>
          {loadingHistory ? <p className="kb-muted">Loading history...</p> : null}
          {error ? <p className="projects-error">{error}</p> : null}

          {messages.map((m, idx) => {
            const isInProgressAssistantMessage =
              m.role === "assistant" && getIsInProgressMessage(m.content);
            const isLastMessage = idx === messages.length - 1;

            if (isInProgressAssistantMessage && !isLastMessage) {
              return null;
            }

            return (
            <div key={m._id || idx} className={`chat-message chat-message--${m.role}`}>
              <div className={`chat-avatar chat-avatar--${m.role}`} aria-hidden="true">
                {m.role === "assistant" ? "🤖" : "🧑"}
              </div>
              <article className={`chat-bubble chat-bubble--${m.role}`}>
                {isInProgressAssistantMessage ? (
                  <ImplementationProgressCard
                    content={m.content || ""}
                    onRefresh={refreshActiveSession}
                    refreshing={loadingHistory}
                  />
                ) : m.role === "assistant" ? (
                  <MarkdownMessage content={m.content || ""} />
                ) : (
                  <p>{m.content}</p>
                )}
              </article>
            </div>
            );
          })}

          {sending ? (
            <div className="chat-message chat-message--assistant">
              <div className="chat-avatar chat-avatar--assistant" aria-hidden="true">
                🤖
              </div>
              <article
                className="chat-bubble chat-bubble--assistant chat-bubble--loading"
                aria-live="polite"
                aria-label="Assistant is typing"
              >
                <span />
                <span />
                <span />
              </article>
            </div>
          ) : null}

          <div ref={streamBottomRef} />
        </div>
        {showPromptLibrary && <PromptLibrary onSelect={(prompt) => {
          setInput(prompt);
          setShowPromptLibrary(false);
        }} />}
        <form className="chat-input-row" onSubmit={onSubmit}>
          <button type="button" className="icon-btn" onClick={() => setShowPromptLibrary((v) => !v)}>
           📖
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onTextareaKeyDown}
            placeholder="Ask the PM agent..."
            rows={3}
          />
          <button type="submit" className="projects-btn" disabled={sending}>
            {sending ? "Sending..." : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
};

export default ChatPanel;