import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { ApiError } from "@magic-admin-v2/api/types";
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog";
import { EmptyState } from "@magic-admin-v2/components/empty-state";
import { Button } from "@magic-admin-v2/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@magic-admin-v2/components/ui/dialog";
import { Form } from "@magic-admin-v2/components/ui/form";
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton";
import { ProviderConfigFields } from "@magic-admin-v2/features/platform-provider-list/components/provider-config-fields";
import {
  ProviderAliasLanguageFields,
  ProviderFooterStatusSwitch,
  ProviderReadonlyIdentity,
  ProviderSortField,
} from "@magic-admin-v2/features/platform-provider-list/components/provider-form-fields";
import {
  providerProxyServerSupported,
  ProviderProxyServerFields,
} from "@magic-admin-v2/features/platform-provider-list/components/provider-proxy-server-fields";
import {
  providerAuthType,
  providerType,
  type ProviderFormValues,
  type ProviderListItem,
} from "@magic-admin-v2/features/platform-provider-list/types";
import {
  getProviderConfigFields,
  shouldShowProviderConfigField,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-config";
import { createProviderFormSchema } from "@magic-admin-v2/features/platform-provider-list/utils/provider-form-schema";
import {
  createEmptyProviderFormValues,
  toProviderFormValues,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-form-values";

export function ProviderConfigDialog({
  canEdit,
  deleting,
  enableProxyServer = providerProxyServerSupported,
  error,
  loading,
  onDelete,
  onOpenChange,
  onSubmit,
  provider,
  providerId,
  saving,
}: {
  canEdit: boolean;
  deleting: boolean;
  enableProxyServer?: boolean;
  error?: ApiError | null;
  loading: boolean;
  onDelete: (provider: ProviderListItem) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (provider: ProviderListItem, values: ProviderFormValues) => Promise<void>;
  provider: ProviderListItem | null;
  providerId: string | null;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProviderListItem | null>(null);
  const deleteSucceededRef = useRef(false);
  const fields = useMemo(
    () => (provider ? getProviderConfigFields(provider, t) : []),
    [provider, t],
  );
  const schema = useMemo(
    () =>
      createProviderFormSchema(t, fields, provider, {
        requireProxyServer: enableProxyServer,
      }),
    [enableProxyServer, fields, provider, t],
  );
  const resolver = useMemo(() => zodResolver(schema), [schema]);
  const form = useForm<ProviderFormValues>({
    defaultValues: createEmptyProviderFormValues(),
    resolver,
  });
  const config = form.watch("config");
  const authType =
    typeof config?.auth_type === "string" ? config.auth_type : providerAuthType.apiKey;
  const visibleFields = useMemo(
    () => fields.filter((field) => shouldShowProviderConfigField(field, provider, authType)),
    [authType, fields, provider],
  );

  useEffect(() => {
    if (provider) {
      form.reset(toProviderFormValues(provider));
    }
  }, [form, provider]);

  useEffect(() => {
    if (!providerId) {
      setDeleteOpen(false);
      setDeleteTarget(null);
      deleteSucceededRef.current = false;
    }
  }, [providerId]);

  async function submit(values: ProviderFormValues) {
    if (!provider || !canEdit) return;
    await onSubmit(provider, values);
    form.reset(values);
  }

  function requestDelete() {
    if (!provider || !canEdit || deleting) return;

    deleteSucceededRef.current = false;
    setDeleteTarget(provider);
    setDeleteOpen(true);
  }

  function handleDeleteOpenChange(open: boolean) {
    setDeleteOpen(open);
    if (!open && !deleteSucceededRef.current) {
      setDeleteTarget(null);
    }
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target || !canEdit || deleting) return;

    try {
      await onDelete(target);
      deleteSucceededRef.current = true;
      setDeleteOpen(false);
    } catch {
      // Keep the confirmation dialog open so the user can retry after a failure.
    }
  }

  function handleDeleteCloseAutoFocus(event: Event) {
    if (!deleteSucceededRef.current) return;

    deleteSucceededRef.current = false;
    event.preventDefault();
    setDeleteTarget(null);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={Boolean(providerId)} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" data-testid="platform-provider-list-dialog-content" closeButtonTestId="provider-config-dialog-close-button">
          <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
            <DialogTitle>{provider?.name ?? t("providerList.detail.title")}</DialogTitle>
            <DialogDescription>{t("providerList.detail.description")}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 pb-6">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          ) : provider ? (
            <Form {...form}>
              <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(submit)}>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
                  <div className="grid gap-4">
                    <ProviderReadonlyIdentity provider={provider} />
                    <ProviderAliasLanguageFields disabled={!canEdit} form={form} />
                    <ProviderConfigFields
                      authType={authType}
                      disabled={!canEdit}
                      fields={visibleFields}
                      form={form}
                      provider={provider}
                    />
                    <ProviderSortField disabled={!canEdit} form={form} />
                    {enableProxyServer ? (
                      <ProviderProxyServerFields disabled={!canEdit} form={form} />
                    ) : null}
                  </div>
                </div>

                <DialogFooter className="shrink-0 gap-3 border-t px-6 py-4 sm:justify-between">
                  <ProviderFooterStatusSwitch disabled={!canEdit} form={form} />
                  <div className="flex flex-wrap justify-end gap-2">
                    {canEdit && provider.provider_type !== providerType.official ? (
                      <Button
                        disabled={deleting}
                        onClick={requestDelete}
                        type="button"
                        variant="destructive"
                       data-testid="platform-provider-list-cancel-button">
                        <Trash2 className="size-4" aria-hidden="true" />
                        {t("common.delete")}
                      </Button>
                    ) : null}
                    <Button
                      disabled={saving}
                      onClick={() => onOpenChange(false)}
                      type="button"
                      variant="outline"
                     data-testid="platform-provider-list-cancel-button">
                      {t("common.cancel")}
                    </Button>
                    {canEdit ? (
                      <Button disabled={!form.formState.isDirty || saving} type="submit" data-testid="platform-provider-list-save-button">
                        {saving ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Save className="size-4" aria-hidden="true" />
                        )}
                        {saving ? t("common.saving") : t("common.save")}
                      </Button>
                    ) : null}
                  </div>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
              <EmptyState
                icon={AlertCircle}
                title={t("providerList.error.detailTitle")}
                description={error?.message ?? t("common.requestFailed")}
              testId="platform-provider-list-error" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
			contentTestId="provider-delete-dialog-content"
			cancelButtonTestId="provider-delete-cancel-button"
			confirmButtonTestId="provider-delete-confirm-button"
        open={deleteOpen}
        title={t("providerList.delete.title")}
        description={t("providerList.delete.description")}
        isPending={deleting}
        onOpenChange={handleDeleteOpenChange}
        onCloseAutoFocus={handleDeleteCloseAutoFocus}
        onConfirm={confirmDelete}
      />
    </>
  );
}
