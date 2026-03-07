import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MobileDevLogin from "./MobileDevLogin";
import MobileDevProjects from "./MobileDevProjects";
import MobileDevChat from "./MobileDevChat";

const MobileDevRoutes = () => {
  return (
    <Routes>
      <Route path="/mob" element={<MobileDevLogin />} />
      <Route path="/mob/projects" element={<MobileDevProjects />} />
      <Route path="/mob/projects/:projectId/chat" element={<MobileDevChat />} />
      <Route path="*" element={<Navigate to="/mob" replace />} />
    </Routes>
  );
};

export default MobileDevRoutes;
