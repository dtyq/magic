import type { RouteObject } from "react-router-dom";
import type { RuntimeMode } from "@magic-admin-v2/constants/runtime";
import { DashboardLayoutSkeleton } from "@magic-admin-v2/layouts/dashboard-layout-skeleton";
import { RoutesContext } from "@magic-admin-v2/routes/context";
import { RouteGuard } from "@magic-admin-v2/routes/guards";
import { createRoutes } from "@magic-admin-v2/routes/routes";
import type { Route } from "@magic-admin-v2/routes/types";
import { SecondaryPageSkeleton } from "@magic-admin-v2/components/secondary-page-skeleton";

export type RouteMode = RuntimeMode;

export type CreateRouteObjectsOptions = {
  developmentRoutes?: readonly Route[];
};

export function createRouteObjects(
  mode: RouteMode,
  options: CreateRouteObjectsOptions = {},
): RouteObject[] {
  const routes = createRoutes(mode, options.developmentRoutes);
  return routes.map((route) => toRouteObject(route, routes, true));
}

function toRouteObject(
  route: Route,
  routes?: readonly Route[],
  isRoot = false,
): RouteObject {
  const fallback = isRoot ? <DashboardLayoutSkeleton /> : <SecondaryPageSkeleton />;
  const guardedElement = (
    <RouteGuard fallback={fallback} validate={route.validate}>
      {route.element}
    </RouteGuard>
  );

  return {
    path: route.path,
    index: route.index,
    element: routes ? (
      <RoutesContext.Provider value={routes}>{guardedElement}</RoutesContext.Provider>
    ) : guardedElement,
    children: route.children?.map((child) => toRouteObject(child)),
  } as RouteObject;
}
