import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useLogin, useMe } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n";

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useLogin();
  const { data: me, isLoading: isCheckingSession } = useMe({
    redirectOnAuthFailure: false,
  });
  const hasOauthError = searchParams.get("error") === "oauth_failed";

  if (isCheckingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-600">{t("login.checkingSession")}</div>
      </div>
    );
  }

  if (me) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await login.mutateAsync(email);
      navigate("/");
    } catch (error) {
      // Error is handled by mutation
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">
          {t("login.title")}
        </h1>

        {hasOauthError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              {t("login.slackError")}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            window.location.href = "/auth/slack/start";
          }}
          className="w-full bg-[#4A154B] text-white py-3 rounded-md hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:ring-[#4A154B] transition-colors mb-4"
        >
          {t("login.continueWithSlack")}
        </button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-500">{t("login.orUseEmail")}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("login.emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.emailPlaceholder")}
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={login.isPending}
            />
          </div>

          {login.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">
                {login.error instanceof Error
                  ? login.error.message
                  : t("login.domainError")}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {login.isPending ? t("login.loggingIn") : t("login.loginButton")}
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-6 text-center">
          {t("login.authorizedDomainsOnly")}
        </p>
      </div>
    </div>
  );
}
