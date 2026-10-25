import type { PropsWithChildren, ReactNode } from "react";

type I18nReadyBoundaryProps = PropsWithChildren<{
  fallback?: ReactNode;
  ready: boolean;
}>;

export function I18nReadyBoundary({
  children,
  fallback = null,
  ready,
}: I18nReadyBoundaryProps) {
  return ready ? children : fallback;
}
