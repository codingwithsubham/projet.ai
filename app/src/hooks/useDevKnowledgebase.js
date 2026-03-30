import { useEffect, useState, useCallback } from "react";
import { getKnowledgeDocumentsByProjectApi } from "../services/knowledgebase.api";
import { getRepositoriesApi } from "../services/project.api";

export const useDevKnowledgebase = (projectId) => {
  const [docs, setDocs] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError("");

    try {
      const [docsRes, reposRes] = await Promise.allSettled([
        getKnowledgeDocumentsByProjectApi(projectId),
        getRepositoriesApi(projectId),
      ]);

      if (docsRes.status === "fulfilled" && docsRes.value?.data) {
        setDocs(docsRes.value.data);
      }

      if (reposRes.status === "fulfilled" && reposRes.value?.data) {
        setRepositories(reposRes.value.data);
      }
    } catch (err) {
      setError("Failed to load project data.");
    }

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { docs, repositories, loading, error };
};
