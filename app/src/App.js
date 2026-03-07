import "./App.css";
import "./mob.css"
import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/landing/Landing";
import Dashboard from "./pages/dashboard/Dashboard";
import Projects from "./pages/projects/Projects";
import ProjectDetails from "./pages/projects/ProjectDetails";
import Settings from "./pages/settings/Settings";
import Users from "./pages/users/Users";
import ApiKeys from "./pages/api-keys/ApiKeys";
import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute";
import AppLayout from "./routes/AppLayout";
import AdminRoute from "./routes/AdminRoute";
import MobileDevRoutes from "./mobile/dev/MobileDevRoutes";

const isMobileClient = () => {
  if (typeof window === "undefined") return false;

  const ua = window.navigator?.userAgent || "";
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isNarrowViewport = window.innerWidth <= 900;

  return isMobileUa || isNarrowViewport;
};

function App() {
  if (isMobileClient()) {
    return <MobileDevRoutes />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <Landing />
          </PublicRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
        <Route
          path="/api-keys"
          element={
            <AdminRoute>
              <ApiKeys />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="/mob/*" element={<Navigate to="/" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
