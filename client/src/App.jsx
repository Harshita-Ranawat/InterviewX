import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Shell from "./components/Shell.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import InterviewsPage from "./pages/InterviewsPage.jsx";
import InterviewRoomPage from "./pages/InterviewRoomPage.jsx";
import AIInterviewPage from "./pages/AIInterviewPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import InvitePage from "./pages/InvitePage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import MailSettingsPage from "./pages/MailSettingsPage.jsx";
import GmailInviteCallbackPage from "./pages/GmailInviteCallbackPage.jsx";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-ink-950">
        Loading session…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="/home" element={<LandingPage />} />

      <Route
        element={
          <PrivateRoute>
            <Shell />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/interviews" element={<InterviewsPage />} />
        <Route path="/room/:code" element={<InterviewRoomPage />} />
        <Route path="/ai-interview" element={<AIInterviewPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings/mail" element={<MailSettingsPage />} />
        <Route path="/oauth/gmail-invite" element={<GmailInviteCallbackPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
