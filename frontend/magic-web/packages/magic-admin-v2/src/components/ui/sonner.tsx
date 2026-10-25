import {
  CircleCheck,
  Info,
  Loader2,
  OctagonX,
  TriangleAlert,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";
import { useRuntime } from "@magic-admin-v2/runtime/context";
import { cn } from "@magic-admin-v2/utils/cn";

export function Toaster() {
  const { theme, isThemeSwitching } = useRuntime();

  return (
    <Sonner
      className={cn(
        "toaster magic-admin-portal-scope group [&_div[data-content]]:w-full",
        theme === "dark" && "dark",
        isThemeSwitching && "theme-switching",
      )}
      icons={{
        success: <CircleCheck className="size-4" />,
        info: <Info className="size-4" />,
        warning: <TriangleAlert className="size-4" />,
        error: <OctagonX className="size-4" />,
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
      position="top-center"
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
    />
  );
}
