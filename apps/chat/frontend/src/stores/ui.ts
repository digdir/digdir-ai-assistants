import { create } from "zustand";
import type { MessageChunk } from "@/types";

interface UIState {
  // Sidebar state
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;

  // Mobile menu
  mobileMenuOpen: boolean;

  // Active conversation
  activeConversationId: string | null;

  // Active chunks to display in right sidebar
  activeChunks: MessageChunk[];

  // Actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setActiveConversationId: (id: string | null) => void;
  setActiveChunks: (chunks: MessageChunk[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  leftSidebarOpen: true,
  rightSidebarOpen: false,
  mobileMenuOpen: false,
  activeConversationId: null,
  activeChunks: [],

  // Actions
  toggleLeftSidebar: () =>
    set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),

  toggleRightSidebar: () =>
    set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),

  setLeftSidebarOpen: (open: boolean) =>
    set({ leftSidebarOpen: open }),

  setRightSidebarOpen: (open: boolean) =>
    set({ rightSidebarOpen: open }),

  toggleMobileMenu: () =>
    set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),

  setMobileMenuOpen: (open: boolean) =>
    set({ mobileMenuOpen: open }),

  setActiveConversationId: (id: string | null) =>
    set({ activeConversationId: id }),

  setActiveChunks: (chunks: MessageChunk[]) =>
    set({ activeChunks: chunks, rightSidebarOpen: chunks.length > 0 }),
}));
