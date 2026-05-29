import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import LandingPage from "@/pages/LandingPage";
import Dashboard from "@/pages/Dashboard";
import ScanResult from "@/pages/ScanResult";
import History from "@/pages/History";
import AuthCallback from "@/pages/AuthCallback";
import AppShell from "@/components/AppShell";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-sm tracking-wide text-muted-foreground" data-testid="loading-state">
          AUTHENTICATING...
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/scan/:scanId" element={<ProtectedRoute><ScanResult /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
