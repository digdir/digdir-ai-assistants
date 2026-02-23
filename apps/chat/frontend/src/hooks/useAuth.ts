import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/stores/auth";

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setLoading } =
    useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    setUser,
    setLoading,
  };
}

// Get current user
export function useMe() {
  const { setUser, setLoading } = useAuthStore();

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      setLoading(true);
      const user = await apiClient.getMe();
      setUser(user);
      return user;
    },
    enabled: !!apiClient.getSessionId(),
    retry: false,
    staleTime: Infinity,
  });
}

// Login mutation
export function useLogin() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: (email: string) => apiClient.login(email),
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

// Logout mutation
export function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: () => apiClient.logout(),
    onSuccess: () => {
      logout();
      queryClient.clear();
    },
  });
}
