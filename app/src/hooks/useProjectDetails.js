import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";

export const useProjectDetails = () => {
  const { id } = useParams();
  const { getProjectById } = useAppData();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [isChatFullView, setIsChatFullView] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setLoading(true);
      setError("");

      const res = await getProjectById(id);
      if (res.ok) {
        setProject(res.data);
      } else {
        setError(res.error || "Failed to load project");
      }

      setLoading(false);
    };

    run();
  }, [getProjectById, id]);

  const tabs = useMemo(
    () => [
      { key: "chat", label: "💭 Talk To Agent" },
      { key: "knowledgebase", label: "📚 Knowledgebase" },
    ],
    []
  );

  return {
    id,
    project,
    loading,
    error,
    tabs,
    activeTab,
    setActiveTab,
    isChatFullView,
    setIsChatFullView,
  };
};