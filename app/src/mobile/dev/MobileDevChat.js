import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import {
  createChatSessionApi,
  getChatHistoryApi,
  getChatSessionsApi,
  sendChatApi,
} from "../../services/chat.api";
import { getProjectByIdApi } from "../../services/project.api";
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
} from "../../services/auth.storage";

const isDevUser = (user) => String(user?.role || "").toLowerCase() === "dev";
const THINKING_STEPS = [
  "Analyzing project context...",
  "Reviewing chat history...",
  "Drafting response...",
];

const MobileDevChat = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const streamRef = useRef(null);
  const streamBottomRef = useRef(null);

  const [projectName, setProjectName] = useState("Project Chat");
  const [activeTab, setActiveTab] = useState("chat");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [thinkingStep, setThinkingStep] = useState(0);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTime = new Date(a?.createdAt || 0).getTime();
      const bTime = new Date(b?.createdAt || 0).getTime();
      return aTime - bTime;
    });
  }, [messages]);

  useEffect(() => {
    if (activeTab !== "chat") return;

    const streamElement = streamRef.current;
    if (streamElement) {
      streamElement.scrollTop = streamElement.scrollHeight;
    }

    streamBottomRef.current?.scrollIntoView({ block: "end" });
  }, [sortedMessages, sending, loading, activeTab]);

  const ensureAccess = () => {
    const token = getAuthToken();
    const user = getAuthUser();

    if (!token || !user || !isDevUser(user)) {
      clearAuthSession();
      navigate("/mob", { replace: true });
      return false;
    }

    return true;
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate("/mob", { replace: true });
  };

  const fetchSessions = async () => {
    const response = await getChatSessionsApi(projectId);
    const sessionRows = Array.isArray(response?.data) ? response.data : [];
    setSessions(sessionRows);
    return sessionRows;
  };

  const loadHistory = async (nextSessionId) => {
    const response = await getChatHistoryApi(
      projectId,
      nextSessionId || undefined,
    );
    const history = response?.data;
    setSessionId(String(history?.sessionId || ""));
    setMessages(Array.isArray(history?.chats) ? history.chats : []);
  };

  useEffect(() => {
    if (!ensureAccess()) return;

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const [projectRes, sessionRows] = await Promise.all([
          getProjectByIdApi(projectId),
          fetchSessions(),
        ]);

        setProjectName(projectRes?.data?.name || "Project Chat");

        if (sessionRows.length > 0) {
          await loadHistory(sessionRows[0]._id);
        }
      } catch (nextError) {
        const message =
          nextError?.response?.data?.message ||
          nextError?.message ||
          "Failed to load chat";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!sending) {
      setThinkingStep(0);
      return;
    }

    const timer = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % THINKING_STEPS.length);
    }, 1400);

    return () => clearInterval(timer);
  }, [sending]);

  const createSession = async () => {
    const created = await createChatSessionApi(projectId, "New Chat");
    const createdSessionId = String(created?.data?._id || "");

    await fetchSessions();

    if (createdSessionId) {
      setSessionId(createdSessionId);
      setMessages([]);
    }
  };

  const handleSend = async () => {
    const cleanInput = input.trim();
    if (!cleanInput || sending) return;

    const optimisticUserMessage = {
      _id: `temp-${Date.now()}`,
      role: "user",
      content: cleanInput,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const response = await sendChatApi(
        projectId,
        cleanInput,
        sessionId || undefined,
      );
      const data = response?.data;

      setSessionId(String(data?.sessionId || ""));
      setMessages(Array.isArray(data?.chats) ? data.chats : []);
      await fetchSessions();
    } catch (nextError) {
      const message =
        nextError?.response?.data?.message ||
        nextError?.message ||
        "Failed to send chat";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const handleSessionSelect = async (nextSessionId) => {
    setActiveTab("chat");
    setLoading(true);
    setError("");

    try {
      await loadHistory(nextSessionId);
    } catch (nextError) {
      const message =
        nextError?.response?.data?.message ||
        nextError?.message ||
        "Failed to load selected chat";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mob-shell mob-shell--chatnext">
      <div className="mob-chat-nav">
        <div className="mob-projects-brand">
          <span className="mob-projects-brand__logo" aria-hidden="true">
            🤖
          </span>
          <div>
            <p className="mob-projects-brand__name">Pro-jet.ai</p>
            <p className="mob-projects-brand__tag">AI Dev Chat</p>
          </div>
        </div>

        <div className="mob-chat-nav__actions">
          <button
            type="button"
            className="mob-chat-nav-btn"
            onClick={() => navigate("/mob/projects")}
            title="Back to projects"
          >
            <span aria-hidden="true">❮</span>
          </button>
          <button
            type="button"
            className="mob-chat-nav-btn"
            onClick={createSession}
            title="New Chat"
          >
            <span aria-hidden="true">✚</span>
          </button>
          <button
            type="button"
            className="mob-chat-nav-btn"
            onClick={handleLogout}
            title="Sign out"
          >
            <span aria-hidden="true">➜]</span>
          </button>
        </div>
      </div>
      <div className="mob-tabs mob-tabs--nextgen" style={{ marginBottom: 5 }}>
        <button
          type="button"
          className={`mob-tab ${activeTab === "chat" ? "mob-tab--active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          <span aria-hidden="true">💭</span>
          Chat
        </button>
        <button
          type="button"
          className={`mob-tab ${activeTab === "history" ? "mob-tab--active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <span aria-hidden="true">⏳</span>
          History
        </button>
      </div>
      <div className="mob-card mob-page-card mob-chat-card mob-chat-card--nextgen">
        {error ? <p className="mob-error">{error}</p> : null}

        {activeTab === "history" ? (
          <div className="mob-history-list mob-history-list--nextgen">
            {sessions.length === 0 ? (
              <p className="mob-info">No chat sessions yet.</p>
            ) : null}
            {sessions.map((session) => (
              <button
                key={session._id}
                type="button"
                className={`mob-history-item ${String(sessionId) === String(session._id) ? "mob-history-item--active" : ""}`}
                onClick={() => handleSessionSelect(session._id)}
              >
                <span className="mob-history-item__title">
                  {session.title || "New Chat"}
                </span>
                <small>{session.agentType || "general"}</small>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="mob-chat-thread mob-chat-thread--nextgen" ref={streamRef}>
              {loading ? <p className="mob-info">Loading chat...</p> : null}
              {!loading && sortedMessages.length === 0 ? (
                <p className="mob-info">
                  Start a conversation with your project agent.
                </p>
              ) : null}

              {sortedMessages.map((message, index) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={`${message._id || "m"}-${index}`}
                    className={`mob-bubble ${isUser ? "mob-bubble--user" : "mob-bubble--assistant"}`}
                  >
                    <span className="mob-bubble__role">
                      {isUser ? "You" : "Dev Agent"}
                    </span>
                    {isUser ? (
                      <p>{message.content}</p>
                    ) : (
                      <ReactMarkdown>
                        {message.content || ""}
                      </ReactMarkdown>
                    )}
                  </div>
                );
              })}

              {sending ? (
                <div className="mob-bubble mob-bubble--assistant mob-bubble--thinking" aria-live="polite">
                  <span className="mob-bubble__role">AI Agent</span>
                  <p className="mob-thinking-text">{THINKING_STEPS[thinkingStep]}</p>
                  <div className="mob-thinking-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}

              <div ref={streamBottomRef} />
            </div>

            <div className="mob-chat-input mob-chat-input--nextgen">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                  }
                }}
                placeholder="Ask your project agent"
              />
              <button
                type="button"
                className="mob-btn"
                disabled={sending}
                onClick={handleSend}
              >
                {sending ? "Thinking..." : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default MobileDevChat;
