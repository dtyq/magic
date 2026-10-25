import { create } from "zustand";

type AppShellState = {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
};

export const useAppShellStore = create<AppShellState>((set) => ({
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  setMobileSidebarOpen: (isOpen) => set({ isMobileSidebarOpen: isOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  toggleMobileSidebar: () =>
    set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
}));
