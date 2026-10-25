import { Check, ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input";
import { DeleteConfirmDialog } from "@magic-admin-v2/components/delete-confirm-dialog";
import { Button } from "@magic-admin-v2/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover";
import {
  useCreateProviderOriginalModelIdMutation,
  useDeleteProviderOriginalModelIdMutation,
} from "@magic-admin-v2/features/platform-model-list/mutations";
import { useProviderOriginalModelIdsQuery } from "@magic-admin-v2/features/platform-model-list/queries";
import {
  providerOriginalModelIdType,
  type ProviderOriginalModelId,
} from "@magic-admin-v2/features/platform-model-list/types";
import { cn } from "@magic-admin-v2/utils/cn";

export function ModelIdentifierPicker({
  disabled,
  fieldId,
  onChange,
  value,
}: {
  disabled: boolean;
  fieldId: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslation();
  const originalModelIdsQuery = useProviderOriginalModelIdsQuery();
  const createModelIdMutation = useCreateProviderOriginalModelIdMutation();
  const deleteModelIdMutation = useDeleteProviderOriginalModelIdMutation();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProviderOriginalModelId | null>(null);
  const normalizedKeyword = keyword.trim();
  const modelIds = useMemo(() => originalModelIdsQuery.data ?? [], [originalModelIdsQuery.data]);
  const filteredModelIds = useMemo(
    () =>
      modelIds.filter((item) =>
        item.model_id.toLocaleLowerCase().includes(normalizedKeyword.toLocaleLowerCase()),
      ),
    [modelIds, normalizedKeyword],
  );
  const hasExactMatch = modelIds.some((item) => item.model_id === normalizedKeyword);

  useEffect(() => {
    if (!open) {
      setKeyword("");
    }
  }, [open]);

  async function createModelIdentifier() {
    if (!normalizedKeyword || hasExactMatch || createModelIdMutation.isPending) {
      return;
    }

    try {
      await createModelIdMutation.mutateAsync(normalizedKeyword);
      onChange(normalizedKeyword);
      setOpen(false);
      toast.success(t("modelList.editor.modelIdCreateSuccess"));
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : t("modelList.editor.modelIdCreateFailed");
      toast.error(message);
    }
  }

  async function deleteModelIdentifier() {
    if (!deleteTarget || deleteModelIdMutation.isPending) {
      return;
    }

    const target = deleteTarget;
    try {
      await deleteModelIdMutation.mutateAsync(target.id);
      if (value === target.model_id) {
        onChange("");
      }
      setDeleteTarget(null);
      toast.success(t("modelList.editor.modelIdDeleteSuccess"));
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : t("modelList.editor.modelIdDeleteFailed");
      toast.error(message);
    }
  }

  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger data-testid="platform-model-identifier-trigger"
          aria-label={t("modelList.editor.field.modelId")}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 py-2 text-left text-sm shadow-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
          )}
          data-model-editor-field={fieldId}
          disabled={disabled}
          id={fieldId}
        >
          <span className="truncate">{value || t("modelList.editor.placeholder.modelId")}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[100] w-[min(480px,calc(100vw-3rem))] p-0" data-testid="platform-model-list-filter-content">
          <div className="border-b p-3">
            <FilterSearchInput
              autoFocus
              clearLabel={t("common.clear")}
              onValueChange={setKeyword}
              placeholder={t("modelList.editor.placeholder.searchModelId")}
              value={keyword}
             inputTestId="platform-model-list-search-input" clearButtonTestId="platform-model-list-search-clear-button"/>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {originalModelIdsQuery.isLoading ? (
              <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              </div>
            ) : filteredModelIds.length ? (
              filteredModelIds.map((item) => {
                const canDelete = item.type === providerOriginalModelIdType.nonOfficial;
                const isDeleting = deleteModelIdMutation.isPending
                  && deleteModelIdMutation.variables === item.id;

                return (
                  <div className="flex items-center gap-1 rounded-sm hover:bg-accent" key={item.id}>
                    <button data-testid="platform-model-identifier-option"
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2.5 py-2 text-left text-sm"
                      onClick={() => {
                        onChange(item.model_id);
                        setOpen(false);
                      }}
                      type="button"
                    >
                      <span className="truncate">{item.model_id}</span>
                      {item.model_id === value ? (
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                      ) : null}
                    </button>
                    {canDelete ? (
                      <Button
                        aria-label={t("modelList.editor.action.deleteModelId", {
                          modelId: item.model_id,
                        })}
                        className="mr-1 size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={deleteModelIdMutation.isPending}
                        onClick={() => {
                          setOpen(false);
                          setDeleteTarget(item);
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                       data-testid="platform-model-list-delete-button">
                        {isDeleting ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="flex h-20 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                {originalModelIdsQuery.isError
                  ? t("modelList.editor.modelIdLoadFailed")
                  : t("modelList.editor.modelIdEmpty")}
              </div>
            )}
          </div>
          {normalizedKeyword && !hasExactMatch ? (
            <div className="border-t p-1.5">
              <Button
                className="w-full justify-start"
                disabled={createModelIdMutation.isPending}
                onClick={() => void createModelIdentifier()}
                size="sm"
                type="button"
                variant="ghost"
               data-testid="platform-model-list-confirm-button">
                {createModelIdMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                {t("modelList.editor.action.createModelId", { modelId: normalizedKeyword })}
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <DeleteConfirmDialog
			contentTestId="model-identifier-delete-dialog-content"
			cancelButtonTestId="model-identifier-delete-cancel-button"
			confirmButtonTestId="model-identifier-delete-confirm-button"
        open={Boolean(deleteTarget)}
        title={t("modelList.editor.modelIdDeleteTitle")}
        description={t("modelList.editor.modelIdDeleteDescription", {
          modelId: deleteTarget?.model_id ?? "",
        })}
        isPending={deleteModelIdMutation.isPending}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={deleteModelIdentifier}
      />
    </>
  );
}
