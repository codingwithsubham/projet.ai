import { useEffect, useMemo } from "react";
import { useAppData } from "../context/AppDataContext";

const formatDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString();
};

export const useDashboard = () => {
  const { projects, projectsLoading, projectsError, fetchProjects } = useAppData();

  useEffect(() => {
    if (!projects.length) {
      fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  const latestProjects = useMemo(() => projects.slice(0, 4), [projects]);

  const summaryTiles = useMemo(() => {
    const tiles = latestProjects.map((project) => ({
      id: project._id,
      name: project.name || "Untitled Project",
      description: project.description || "No description",
      model: project.model || "N/A",
      createdBy: project.createdBy || "N/A",
      createdAt: formatDate(project.createdAt),
      isEmpty: false,
    }));

    while (tiles.length < 4) {
      tiles.push({
        id: `placeholder-${tiles.length + 1}`,
        name: "No Project",
        description: "Create a new project to see summary here.",
        model: "N/A",
        createdBy: "N/A",
        createdAt: "N/A",
        isEmpty: true,
      });
    }

    return tiles;
  }, [latestProjects]);

  return {
    summaryTiles,
    totalProjects: projects.length,
    projectsLoading,
    projectsError,
    refreshProjects: fetchProjects,
  };
};