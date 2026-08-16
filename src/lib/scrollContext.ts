import { createContext, useContext } from "react";

// Whether the shared <main> scroll container (see AppShell) has
// scrolled past its top edge — read by PageHeader so a page's sticky
// title bar can grow a bottom border/shadow only once there's actually
// content sliding underneath it, not permanently.
export const MainScrolledContext = createContext(false);

export function useMainScrolled(): boolean {
  return useContext(MainScrolledContext);
}
