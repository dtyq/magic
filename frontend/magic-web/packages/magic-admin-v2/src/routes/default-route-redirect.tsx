import { useMemo } from "react";
import { Navigate, useResolvedPath } from "react-router-dom";
import { RoutePath } from "@magic-admin-v2/constants/routes";
import { useRouteConfig } from "@magic-admin-v2/routes/context";
import { createNavigation, getDefaultNavigationHref } from "@magic-admin-v2/routes/menu";
import { useRuntime } from "@magic-admin-v2/runtime/context";

export function DefaultRouteRedirect() {
  const routes = useRouteConfig();
  const { access } = useRuntime();
  const routeBasePath = useResolvedPath(".").pathname;
  const navigation = useMemo(
    () => createNavigation(routes, access, routeBasePath),
    [access, routeBasePath, routes],
  );
  const defaultHref = getDefaultNavigationHref(navigation);

  return <Navigate replace to={defaultHref ?? RoutePath.Forbidden} />;
}
