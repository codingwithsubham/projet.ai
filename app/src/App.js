import "./App.css";
import "./styles/mob.css"
import "./styles/presentations.css";
import "./styles/documents.css";
import "./styles/activity.css";
import "./styles/Marketplace.css";
import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/landing/Landing";
import Dashboard from "./pages/dashboard/Dashboard";
import Projects from "./pages/projects/Projects";
import ProjectDetails from "./pages/projects/ProjectDetails";
import Settings from "./pages/settings/Settings";
import Users from "./pages/users/Users";
import ApiKeys from "./pages/api-keys/ApiKeys";
import ChatPage from "./pages/chat/ChatPage";
import PresentationLanding from "./pages/presentations/PresentationLanding";
import PresentationCreation from "./pages/presentations/PresentationCreation";
import PresentationView from "./pages/presentations/PresentationView";
import DocumentLanding from "./pages/documents/DocumentLanding";
import DocumentCreation from "./pages/documents/DocumentCreation";
import DocumentView from "./pages/documents/DocumentView";
import ActivityDashboard from "./pages/activity/ActivityDashboard";
import MarketplacePage from "./pages/marketplace/MarketplacePage";
import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute";
import AppLayout from "./routes/AppLayout";
import AdminRoute from "./routes/AdminRoute";
import PMRoute from "./routes/PMRoute";
import SubscribedRoute from "./routes/SubscribedRoute";
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
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route
          path="/presentations"
          element={
            <SubscribedRoute>
              <PresentationLanding />
            </SubscribedRoute>
          }
        />
        <Route
          path="/presentations/create"
          element={
            <SubscribedRoute>
              <PresentationCreation />
            </SubscribedRoute>
          }
        />
        <Route
          path="/presentations/:id"
          element={
            <SubscribedRoute>
              <PresentationView />
            </SubscribedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <SubscribedRoute>
              <DocumentLanding />
            </SubscribedRoute>
          }
        />
        <Route
          path="/documents/create"
          element={
            <SubscribedRoute>
              <DocumentCreation />
            </SubscribedRoute>
          }
        />
        <Route
          path="/documents/:id"
          element={
            <SubscribedRoute>
              <DocumentView />
            </SubscribedRoute>
          }
        />
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
        <Route
          path="/activity"
          element={
            <PMRoute>
              <ActivityDashboard />
            </PMRoute>
          }
        />
      </Route>

      <Route path="/mob/*" element={<Navigate to="/" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
