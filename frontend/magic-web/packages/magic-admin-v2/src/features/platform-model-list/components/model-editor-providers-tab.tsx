import { Plus } from "lucide-react";
import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "@magic-admin-v2/components/ui/button";
import { ProviderBindingCard } from "@magic-admin-v2/features/platform-model-list/components/provider-binding-card";
import {
  type ProviderModelCategory,
  type ProviderModelSaveResult,
  type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types";
import { getErrorMessage } from "@magic-admin-v2/features/platform-model-list/utils/model-editor";
import type {
  ModelEditorValues,
  ProviderBindingErrors,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema";
import type { ModelEditorFocusRequest } from "@magic-admin-v2/features/platform-model-list/utils/model-editor-types";

export function ModelEditorProvidersTab({
  category,
  disabled,
  hasOfficialSyncedBinding,
  officialSyncedRecordIds,
  fields,
  focusRequest,
  form,
  modelType,
  onAdd,
  onRemove,
  saveResults,
}: {
  category: ProviderModelCategory;
  disabled: boolean;
  hasOfficialSyncedBinding: boolean;
  officialSyncedRecordIds: ReadonlySet<string>;
  fields: Array<FieldArrayWithId<ModelEditorValues, "providers", "id">>;
  focusRequest: ModelEditorFocusRequest | null;
  form: UseFormReturn<ModelEditorValues>;
  modelType: ProviderModelType;
  onAdd: () => void;
  onRemove: (index: number) => void;
  saveResults: Record<string, ProviderModelSaveResult>;
}) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="provider-bindings-title" data-model-editor-field="providers" tabIndex={-1}>
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold" id="provider-bindings-title">
            {t("modelList.editor.bindingTitle")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("modelList.editor.bindingDescription")}
          </p>
        </div>
        <Button
          disabled={disabled || hasOfficialSyncedBinding}
          onClick={onAdd}
          type="button"
          variant="outline"
         data-testid="platform-model-list-delete-button">
          <Plus className="size-4" aria-hidden="true" />
          {t("modelList.editor.action.addProvider")}
        </Button>
      </div>

      {form.formState.errors.providers?.root?.message ? (
        <p className="mt-3 text-sm text-destructive">
          {getErrorMessage(form.formState.errors.providers.root.message)}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        {fields.map((field, index) => (
          <ProviderBindingCard
            canRemove={fields.length > 1}
            category={category}
            control={form.control}
            disabled={disabled}
            officialSyncedRecordIds={officialSyncedRecordIds}
            error={form.formState.errors.providers?.[index] as ProviderBindingErrors | undefined}
            form={form}
            focusRequest={focusRequest}
            index={index}
            key={field.id}
            modelType={modelType}
            onRemove={() => onRemove(index)}
            result={saveResults[field.client_key]}
          />
        ))}
      </div>
    </section>
  );
}
