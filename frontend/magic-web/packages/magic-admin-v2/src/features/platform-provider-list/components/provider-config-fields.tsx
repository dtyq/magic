import { Upload } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef } from "react";
import type { FieldPath, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@magic-admin-v2/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@magic-admin-v2/components/ui/form";
import { Input } from "@magic-admin-v2/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@magic-admin-v2/components/ui/select";
import { Textarea } from "@magic-admin-v2/components/ui/textarea";
import {
  googleProviderCodes,
  mergeGoogleServiceAccountConfig,
  parseGoogleServiceAccountJson,
  type ProviderConfigField,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-config";
import {
  providerAuthType,
  type ProviderConfig,
  type ProviderFormValues,
  type ProviderListItem,
  type ProviderTemplate,
} from "@magic-admin-v2/features/platform-provider-list/types";

export function ProviderConfigFields({
  authType,
  disabled = false,
  fields,
  form,
  provider,
}: {
  authType: string;
  disabled?: boolean;
  fields: ProviderConfigField[];
  form: UseFormReturn<ProviderFormValues>;
  provider: ProviderListItem | ProviderTemplate | null;
}) {
  const { t } = useTranslation();
  const isGoogle = provider ? googleProviderCodes.has(provider.provider_code) : false;

  if (!provider) return null;

  function handleGoogleConfigImport(importedConfig: ProviderConfig) {
    form.setValue(
      "config",
      mergeGoogleServiceAccountConfig(form.getValues("config"), importedConfig),
      { shouldDirty: true, shouldTouch: true, shouldValidate: true },
    );
  }

  return (
    <div className="grid gap-4">
      {isGoogle ? (
        <FormField
          control={form.control}
          name="config.auth_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t("providerList.field.authType")}
                <RequiredMark />
              </FormLabel>
              <Select
                disabled={disabled}
                value={typeof field.value === "string" ? field.value : providerAuthType.apiKey}
                onValueChange={field.onChange}
              >
                <FormControl>
                  <SelectTrigger data-testid="platform-provider-list-select-trigger">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent data-testid="platform-provider-list-select-content">
                  <SelectItem value={providerAuthType.apiKey} data-testid="platform-provider-list-option">Google AI Studio</SelectItem>
                  <SelectItem value={providerAuthType.serviceAccount} data-testid="platform-provider-list-option">
                    Google Cloud Vertex AI
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>{t("providerList.fieldDesc.authType")}</FormDescription>
            </FormItem>
          )}
        />
      ) : null}

      {isGoogle && authType === providerAuthType.serviceAccount ? (
        <GoogleServiceAccountJsonImport
          disabled={disabled}
          onImport={handleGoogleConfigImport}
        />
      ) : null}

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("providerList.config.empty")}
        </div>
      ) : (
        fields.map((fieldConfig) => (
          <FormField
            control={form.control}
            key={`${authType}-${fieldConfig.key}`}
            name={`config.${fieldConfig.key}` as FieldPath<ProviderFormValues>}
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>
                  {fieldConfig.label}
                  {fieldConfig.required ? <RequiredMark /> : null}
                </FormLabel>
                <FormControl>
                  {fieldConfig.inputType === "textarea" ? (
                    <Textarea
                      className="min-h-28 font-mono text-xs"
                      disabled={disabled}
                      onChange={field.onChange}
                      placeholder={fieldConfig.placeholder}
                      value={typeof field.value === "string" ? field.value : ""}
                    data-testid="platform-provider-list-textarea-input" />
                  ) : (
                    <Input
                      disabled={disabled}
                      onChange={field.onChange}
                      placeholder={fieldConfig.placeholder}
                      type={fieldConfig.inputType === "password" ? "password" : fieldConfig.inputType}
                      value={typeof field.value === "string" ? field.value : ""}
                    data-testid="platform-provider-list-input" />
                  )}
                </FormControl>
                {fieldConfig.description ? (
                  <FormDescription>{fieldConfig.description}</FormDescription>
                ) : null}
                {fieldState.error ? <FormMessage>{fieldState.error.message}</FormMessage> : null}
              </FormItem>
            )}
          />
        ))
      )}
    </div>
  );
}

function GoogleServiceAccountJsonImport({
  disabled,
  onImport,
}: {
  disabled: boolean;
  onImport: (config: ProviderConfig) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    try {
      onImport(parseGoogleServiceAccountJson(await file.text()));
      toast.success(t("providerList.message.googleJsonImported"));
    } catch {
      toast.error(t("providerList.validation.googleJsonInvalid"));
    } finally {
      event.currentTarget.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{t("providerList.field.googleServiceAccountJson")}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t("providerList.fieldDesc.googleServiceAccountJson")}
        </div>
      </div>
      <input data-testid="platform-provider-config-input"
        accept=".json,application/json"
        className="sr-only"
        disabled={disabled}
        onChange={handleFileChange}
        ref={inputRef}
        type="file"
      />
      <Button
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        type="button"
        variant="outline"
       data-testid="platform-provider-list-upload-button">
        <Upload className="size-4" aria-hidden="true" />
        {t("providerList.action.importJson")}
      </Button>
    </div>
  );
}

function RequiredMark() {
  return <span className="ml-1 text-destructive">*</span>;
}
