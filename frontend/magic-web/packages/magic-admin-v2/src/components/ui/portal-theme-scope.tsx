import * as React from "react";
import { RuntimeContext } from "@magic-admin-v2/runtime/context";
import { cn } from "@magic-admin-v2/utils/cn";

type PortalThemeScopeProps = React.PropsWithChildren<{
  className?: string;
}>;

/** Keeps body-mounted portals inside the admin-v2 theme boundary. */
export const PortalThemeScope = React.forwardRef<HTMLDivElement, PortalThemeScopeProps>(
  function PortalThemeScope({ children, className }, ref) {
  const runtime = React.useContext(RuntimeContext);
  const theme = runtime?.theme ?? "light";
  const isThemeSwitching = runtime?.isThemeSwitching ?? false;

  return (
    <div
      ref={ref}
      className={cn(
        "magic-admin-portal-scope",
        theme === "dark" && "dark",
        isThemeSwitching && "theme-switching",
        className,
      )}
    >
      {children}
    </div>
  );
  },
);
