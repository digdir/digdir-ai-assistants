import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMe } from "@/hooks/useAuth";
import { apiClient } from "@/api/client";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { useAuthStore } from "@/stores/auth";

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user && !apiClient.getSessionId()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function OAuthSessionBootstrap() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    if (hasBootstrapped.current) {
      return;
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = hashParams.get("sessionId") || searchParams.get("sessionId");
    const email = hashParams.get("email") || searchParams.get("email");

    if (!sessionId || !email) {
      return;
    }

    hasBootstrapped.current = true;
    window.history.replaceState(null, "", location.pathname);

    const user = apiClient.completeOAuthLogin(sessionId, email);
    setUser(user);

    if (location.pathname !== "/") {
      navigate("/", { replace: true });
    }
  }, [location.pathname, navigate, setUser]);

  return null;
}

// Main App Router
function AppRouter() {
  return (
    <BrowserRouter>
      <OAuthSessionBootstrap />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/oauth/callback" element={<AuthCallbackPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Root App component
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}
