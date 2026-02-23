import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user: User | null) =>
    set({ user, isAuthenticated: !!user, isLoading: false }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  logout: () => set({ user: null, isAuthenticated: false }),
}));
