import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@magic-admin-v2/components/ui/alert-dialog";
import { Button } from "@magic-admin-v2/components/ui/button";
import { cn } from "@magic-admin-v2/utils/cn";

export type ModelEditorProgress = {
  completed: number;
  failed: number;
  kind: "load" | "save";
  phase: "finished" | "running";
  total: number;
};

export function ModelEditorProgressDialog({
  onClose,
  onRetry,
  progress,
}: {
  onClose: () => void;
  onRetry: () => void;
  progress: ModelEditorProgress | null;
}) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  if (!progress) {
    return null;
  }

  const isRunning = progress.phase === "running";
  const isLoad = progress.kind === "load";
  const progressPercent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  const title = t(
    isLoad
      ? "modelList.editor.progress.loadTitle"
      : !isRunning && !progress.failed
        ? "modelList.editor.progress.saveSuccessTitle"
        : "modelList.editor.progress.saveTitle",
  );
  const completedText = t("modelList.editor.progress.completed", {
    completed: progress.completed,
    total: progress.total,
  });

  return (
    <AlertDialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isRunning) {
          onClose();
        }
      }}
    >
      <AlertDialogContent
        className="max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        ref={contentRef}
        tabIndex={-1}
       data-testid="platform-model-list-alert-dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {isRunning
              ? t("modelList.editor.progress.running")
              : progress.failed
                ? t("modelList.editor.progress.failed", { count: progress.failed })
                : t("modelList.editor.progress.success")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            {isRunning ? (
              <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
            ) : progress.failed ? (
              <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
            )}
            <span className="text-sm font-medium">{completedText}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                progress.failed ? "bg-destructive" : "bg-primary",
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {!isRunning ? (
          <AlertDialogFooter>
            {progress.failed ? (
              <Button onClick={onRetry} type="button" variant="outline" data-testid="platform-model-list-refresh-button">
                <RefreshCw className="size-4" aria-hidden="true" />
                {t("modelList.editor.progress.retry")}
              </Button>
            ) : null}
            <Button onClick={onClose} type="button" data-testid="platform-model-list-cancel-button">
              {t("modelList.editor.progress.close")}
            </Button>
          </AlertDialogFooter>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
