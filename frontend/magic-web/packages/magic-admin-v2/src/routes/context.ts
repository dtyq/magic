import { createContext, useContext } from "react";
import type { Route } from "@magic-admin-v2/routes/types";

export const RoutesContext = createContext<readonly Route[] | null>(null);

export function useRouteConfig() {
  const routes = useContext(RoutesContext);
  if (!routes) throw new Error("useRouteConfig must be used inside the application route tree");
  return routes;
}
