import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const sessionId = hashParams.get("sessionId") || searchParams.get("sessionId");
    const email = hashParams.get("email") || searchParams.get("email");

    if (!sessionId || !email) {
      console.error("OAuth callback missing params", {
        path: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
      navigate("/login?error=oauth_failed", { replace: true });
      return;
    }

    window.history.replaceState(null, "", "/oauth/callback");
    const user = apiClient.completeOAuthLogin(sessionId, email);
    setUser(user);
    navigate("/", { replace: true });
  }, [navigate, setUser]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-gray-600">Completing sign-in...</div>
    </div>
  );
}
