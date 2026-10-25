import { Suspense, type PropsWithChildren, type ReactNode } from "react";
import AccessDeniedPage from "@magic-admin-v2/pages/access-denied-page";
import { ListPageSkeleton } from "@magic-admin-v2/components/list-page-skeleton";
import { useRuntime } from "@magic-admin-v2/runtime/context";
import type { RouteValidate } from "@magic-admin-v2/routes/types";

type RouteGuardProps = PropsWithChildren<{
  fallback?: ReactNode;
  validate?: RouteValidate;
}>;

export function RouteGuard({ children, fallback, validate }: RouteGuardProps) {
  const runtime = useRuntime();
  const loadingFallback = fallback ?? <ListPageSkeleton testId="route-list-loading" />;

  if (runtime.auth.status === "loading" || runtime.authorizationLoading) {
    return loadingFallback;
  }

  if (runtime.auth.status === "error" || runtime.authorizationError) {
    return <AccessDeniedPage />;
  }

  if (runtime.auth.status === "unauthenticated" || !runtime.access) {
    return <AccessDeniedPage />;
  }

  if (validate && !validate(runtime.access)) {
    return <AccessDeniedPage />;
  }

  return <Suspense fallback={loadingFallback}>{children}</Suspense>;
}
