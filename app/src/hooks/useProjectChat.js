import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChatSessionApi,
  getChatHistoryApi,
  getChatSessionsApi,
  sendChatApi,
  streamChatApi,
  deleteChatSessionApi,
} from "../services/chat.api";

export const useProjectChat = (projectId) => {
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [streamStatus, setStreamStatus] = useState("");

  // Token batching refs (prevents per-character re-renders)
  const tokenBufferRef = useRef("");
  const flushTimerRef = useRef(null);
  const abortRef = useRef(null);

  const loadHistory = useCallback(async (sessionId) => {
    if (!projectId || !sessionId) return;
    setLoadingHistory(true);
    setError("");

    try {
      const res = await getChatHistoryApi(projectId, sessionId);
      setMessages(Array.isArray(res?.data?.chats) ? res.data.chats : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load chat history");
    } finally {
      setLoadingHistory(false);
    }
  }, [projectId]);

  const loadSessions = useCallback(async () => {
    if (!projectId) return [];
    const res = await getChatSessionsApi(projectId);
    return Array.isArray(res?.data) ? res.data : [];
  }, [projectId]);

  const createSession = useCallback(async () => {
    if (!projectId) return null;
    const res = await createChatSessionApi(projectId, "New Chat");
    return res?.data || null;
  }, [projectId]);

  useEffect(() => {
    const init = async () => {
      if (!projectId) return;
      setError("");

      try {
        let nextSessions = await loadSessions();
        if (!nextSessions.length) {
          const created = await createSession();
          if (created?._id) nextSessions = [created];
        }

        setSessions(nextSessions);

        const firstId = nextSessions[0]?._id || "";
        setActiveSessionId(firstId);

        if (firstId) {
          await loadHistory(firstId);
        } else {
          setMessages([]);
        }
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Failed to initialize chat");
      }
    };

    init();
  }, [createSession, loadHistory, loadSessions, projectId]);

  const openSession = useCallback(async (sessionId) => {
    if (!sessionId || sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    await loadHistory(sessionId);
  }, [activeSessionId, loadHistory]);

  const newChat = useCallback(async () => {
    try {
      const created = await createSession();
      if (!created?._id) return;

      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created._id);
      setMessages([]);
      setHistoryOpen(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to create chat");
    }
  }, [createSession]);

  const deleteSession = useCallback(async (sessionId) => {
    if (!projectId || !sessionId) return false;
    
    try {
      await deleteChatSessionApi(projectId, sessionId);
      
      // Remove session from list
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
      
      // If deleted session was active, switch to first session or create new one
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s._id !== sessionId);
        if (remaining.length > 0) {
          await openSession(remaining[0]._id);
        } else {
          const created = await createSession();
          if (created?._id) {
            setSessions([created]);
            setActiveSessionId(created._id);
            setMessages([]);
          }
        }
      }
      
      return true;
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to delete chat");
      return false;
    }
  }, [projectId, activeSessionId, sessions, createSession, openSession]);

  const refreshActiveSession = useCallback(async () => {
    if (!activeSessionId) return;

    await loadHistory(activeSessionId);

    try {
      const refreshed = await loadSessions();
      setSessions(refreshed);
    } catch {
      // Keep refresh resilient; history already attempted above.
    }
  }, [activeSessionId, loadHistory, loadSessions]);

  const sendMessage = useCallback(async () => {
    const message = input.trim();
    if (!projectId || !activeSessionId || !message || sending) return;

    setSending(true);
    setError("");
    setStreamStatus("");
    tokenBufferRef.current = "";

    const optimisticUser = { _id: `temp-${Date.now()}`, role: "user", content: message };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");

    // Flush buffered tokens into the streaming assistant message
    const flushTokens = () => {
      const chunk = tokenBufferRef.current;
      if (!chunk) return;
      tokenBufferRef.current = "";
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last._id === "__streaming__") {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, content: (last.content || "") + chunk };
          return updated;
        }
        return prev;
      });
    };

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      let firstTokenReceived = false;

      await streamChatApi(projectId, message, activeSessionId, {
        signal: abortController.signal,

        onStatus: (status) => {
          setStreamStatus(status);
        },

        onToken: (token) => {
          if (!firstTokenReceived) {
            firstTokenReceived = true;
            setStreamStatus("");
            // Add streaming assistant bubble
            setMessages((prev) => [
              ...prev,
              { _id: "__streaming__", role: "assistant", content: token },
            ]);
          } else {
            // Buffer tokens, flush every 50ms for smooth rendering
            tokenBufferRef.current += token;
            if (!flushTimerRef.current) {
              flushTimerRef.current = setTimeout(() => {
                flushTimerRef.current = null;
                flushTokens();
              }, 50);
            }
          }
        },

        onCached: (cachedResponse) => {
          setStreamStatus("");
          setMessages((prev) => [
            ...prev,
            { _id: `cached-${Date.now()}`, role: "assistant", content: cachedResponse },
          ]);
        },

        onDone: (data) => {
          // Flush any remaining tokens
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
          }
          flushTokens();

          // Replace optimistic messages with server-saved chats
          if (data?.chats && Array.isArray(data.chats)) {
            setMessages(data.chats);
          }
        },

        onError: (errMsg) => {
          setError(errMsg || "Stream error occurred");
        },
      });
    } catch (err) {
      if (err.name === "AbortError") return;

      // Fallback to non-streaming API
      console.warn("Stream failed, falling back to non-streaming:", err.message);
      try {
        const res = await sendChatApi(projectId, message, activeSessionId);
        const chats = res?.data?.chats;
        if (Array.isArray(chats)) setMessages(chats);
      } catch (fallbackErr) {
        setError(fallbackErr?.response?.data?.message || fallbackErr?.message || "Failed to send message");
      }
    } finally {
      setSending(false);
      setStreamStatus("");
      abortRef.current = null;
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

      // Refresh sessions in background
      loadSessions().then((s) => setSessions(s)).catch(() => {});
    }
  }, [activeSessionId, input, loadSessions, projectId, sending]);

  return {
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
  };
};