import { useCallback, useEffect, useState } from "react";
import {
  createChatSessionApi,
  getChatHistoryApi,
  getChatSessionsApi,
  sendChatApi,
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
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);

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

    const optimistic = { _id: `temp-${Date.now()}`, role: "user", content: message };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await sendChatApi(projectId, message, activeSessionId);
      const chats = res?.data?.chats;
      if (Array.isArray(chats)) setMessages(chats);

      const refreshed = await loadSessions();
      setSessions(refreshed);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to send message");
    } finally {
      setSending(false);
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
    showPromptLibrary,
    setShowPromptLibrary,
  };
};