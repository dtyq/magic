import type { LucideIcon } from "lucide-react";
import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@magic-admin-v2/components/ui/tooltip";
import { cn } from "@magic-admin-v2/utils/cn";

type StatusCardProps = {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "info";
  tooltip?: ReactNode;
};

const toneClassName = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
};

export function StatusCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "neutral",
  tooltip,
}: StatusCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-medium text-muted-foreground">{title}</p>
            {tooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={title}
                    className="inline-flex shrink-0 items-center rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                  >
                    <CircleHelp className="size-3.5" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent align="center" className="w-64 text-left" collisionPadding={8} side="top">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-foreground">{value}</p>
        </div>
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", toneClassName[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      {description ? <p className="mt-3 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
