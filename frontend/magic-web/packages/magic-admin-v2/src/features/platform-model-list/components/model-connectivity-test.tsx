import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@magic-admin-v2/components/confirm-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@magic-admin-v2/components/ui/alert-dialog";
import { Badge } from "@magic-admin-v2/components/ui/badge";
import { Button } from "@magic-admin-v2/components/ui/button";
import {
  useProviderModelConnectivityTestMutation,
  type ProviderModelConnectivityTestRequest,
} from "@magic-admin-v2/features/platform-model-list/mutations";
import type { ProviderModelConnectivityTestResult } from "@magic-admin-v2/features/platform-model-list/types";
import { cn } from "@magic-admin-v2/utils/cn";

function formatErrorDetail(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    const detail: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    Object.keys(value).forEach((key) => {
      detail[key] = (value as unknown as Record<string, unknown>)[key];
    });

    try {
      return JSON.stringify(detail, null, 2);
    } catch {
      return value.stack || value.message;
    }
  }

  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export function ModelConnectivityTest({
  className,
  compact = false,
  disabled = false,
  request,
}: {
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  request: ProviderModelConnectivityTestRequest;
}) {
  const { t } = useTranslation();
  const testMutation = useProviderModelConnectivityTestMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [result, setResult] = useState<ProviderModelConnectivityTestResult | null>(null);
  const isSuccessful = Boolean(result?.status);
  const errorDetail = result && !isSuccessful
    ? formatErrorDetail(result.message ?? t("modelList.connectivity.errorFallback"))
    : "";

  async function runTest() {
    try {
      setResult(await testMutation.mutateAsync(request));
    } catch (error) {
      setResult({ status: false, message: error });
    }
  }

  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-2", className)}
      data-model-connectivity-test
    >
      {result ? (
        <div aria-live="polite" className="flex items-center gap-1.5">
          <Badge className={cn(compact && "px-1.5")} variant={isSuccessful ? "success" : "warning"}>
            {isSuccessful ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="size-3.5" aria-hidden="true" />
            )}
            {compact ? null : <>{t("modelList.connectivity.resultLabel")}：</>}
            {isSuccessful
              ? t("modelList.connectivity.status.normal")
              : t("modelList.connectivity.status.error")}
          </Badge>
          {!isSuccessful ? (
            <Button
              className={cn(compact && "px-2")}
              onClick={() => setDetailOpen(true)}
              size="sm"
              type="button"
              variant="ghost"
             data-testid="platform-model-list-confirm-button">
              {t("modelList.connectivity.action.viewDetails")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Button
        className={cn(compact && "px-2.5")}
        disabled={disabled || testMutation.isPending}
        onClick={() => setConfirmOpen(true)}
        size="sm"
        type="button"
        variant="outline"
       data-testid="platform-model-list-confirm-button">
        {testMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {t("modelList.connectivity.action.test")}
      </Button>

      <ConfirmDialog
        description={t("modelList.connectivity.confirmDescription")}
        onConfirm={() => {
          setConfirmOpen(false);
          return runTest();
        }}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={t("modelList.connectivity.confirmTitle")}
       contentTestId="platform-model-list-confirm-dialog-content" cancelButtonTestId="platform-model-list-confirm-dialog-cancel-button" confirmButtonTestId="platform-model-list-confirm-dialog-confirm-button"/>

      <AlertDialog open={detailOpen} onOpenChange={setDetailOpen}>
        <AlertDialogContent className="max-w-2xl" data-testid="platform-model-list-alert-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("modelList.connectivity.errorDetailTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("modelList.connectivity.errorDetailDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs text-foreground">
            {errorDetail}
          </pre>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="platform-model-connectivity-cancel-button">{t("modelList.action.closeDetail")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
