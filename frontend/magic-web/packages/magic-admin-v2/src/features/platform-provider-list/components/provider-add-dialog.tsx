import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@magic-admin-v2/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@magic-admin-v2/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@magic-admin-v2/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@magic-admin-v2/components/ui/select";
import { ProviderCategorySelect } from "@magic-admin-v2/features/platform-provider-list/components/provider-category-controls";
import { ProviderConfigFields } from "@magic-admin-v2/features/platform-provider-list/components/provider-config-fields";
import {
  ProviderAliasLanguageFields,
  ProviderFooterStatusSwitch,
  ProviderRequiredMark,
  ProviderTemplateOptionContent,
  ProviderTemplateSelectValue,
} from "@magic-admin-v2/features/platform-provider-list/components/provider-form-fields";
import {
  providerAuthType,
  type ProviderCategory,
  type ProviderFormValues,
  type ProviderTemplate,
} from "@magic-admin-v2/features/platform-provider-list/types";
import {
  getProviderConfigFields,
  shouldShowProviderConfigField,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-config";
import { createAddProviderFormSchema } from "@magic-admin-v2/features/platform-provider-list/utils/provider-form-schema";
import {
  applyProviderTemplateSelection,
  createEmptyProviderFormValues,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-form-values";

export function ProviderAddDialog({
  category,
  editableCategories,
  onCategoryChange,
  onOpenChange,
  onSubmit,
  open,
  submitting,
  templates,
  templatesLoading,
}: {
  category: ProviderCategory;
  editableCategories: readonly ProviderCategory[];
  onCategoryChange: (category: ProviderCategory) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProviderFormValues, template: ProviderTemplate) => Promise<void>;
  open: boolean;
  submitting: boolean;
  templates: ProviderTemplate[];
  templatesLoading: boolean;
}) {
  const { t } = useTranslation();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const fields = useMemo(
    () => (selectedTemplate ? getProviderConfigFields(selectedTemplate, t) : []),
    [selectedTemplate, t],
  );
  const schema = useMemo(
    () => createAddProviderFormSchema(t, fields, selectedTemplate),
    [fields, selectedTemplate, t],
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
    () => fields.filter((field) => shouldShowProviderConfigField(field, selectedTemplate, authType)),
    [authType, fields, selectedTemplate],
  );

  useEffect(() => {
    if (!open) {
      form.reset(createEmptyProviderFormValues());
      setSelectedTemplateId("");
    }
  }, [form, open]);

  function handleCategoryChange(nextCategory: ProviderCategory) {
    onCategoryChange(nextCategory);
    form.reset(
      {
        ...form.getValues(),
        service_provider_id: "",
        config: {},
      },
      { keepDirty: false },
    );
    setSelectedTemplateId("");
  }

  function handleTemplateChange(nextTemplateId: string) {
    const template = templates.find((item) => item.id === nextTemplateId) ?? null;
    setSelectedTemplateId(nextTemplateId);
    form.reset(
      template
        ? applyProviderTemplateSelection(form.getValues(), template)
        : {
            ...form.getValues(),
            service_provider_id: nextTemplateId,
            config: {},
          },
      { keepDirty: true },
    );
    void form.trigger("service_provider_id");
  }

  async function submit(values: ProviderFormValues) {
    if (!selectedTemplate) return;
    await onSubmit(values, selectedTemplate);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" data-testid="platform-provider-list-dialog-content" closeButtonTestId="provider-add-dialog-close-button">
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
          <DialogTitle>{t("providerList.action.add")}</DialogTitle>
          <DialogDescription>{t("providerList.dialog.addDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(submit)}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <span className="text-sm font-medium leading-none">
                    {t("providerList.field.category")}
                  </span>
                  <ProviderCategorySelect
                    categories={editableCategories}
                    value={category}
                    onChange={handleCategoryChange}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="service_provider_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("providerList.field.template")}
                        <ProviderRequiredMark />
                      </FormLabel>
                      <Select
                        disabled={templatesLoading}
                        value={field.value ?? ""}
                        onValueChange={handleTemplateChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-auto min-h-9 w-full py-1.5" data-testid="platform-provider-list-select-trigger">
                            <ProviderTemplateSelectValue
                              placeholder={t("providerList.placeholder.template")}
                              template={selectedTemplate}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent data-testid="platform-provider-list-select-content">
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id} data-testid="platform-provider-list-option">
                              <ProviderTemplateOptionContent provider={template} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <ProviderAliasLanguageFields form={form} />
                <ProviderConfigFields
                  authType={authType}
                  fields={visibleFields}
                  form={form}
                  provider={selectedTemplate}
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 gap-3 border-t px-6 py-4 sm:justify-between">
              <ProviderFooterStatusSwitch form={form} />
              <div className="flex justify-end gap-2">
                <Button
                  disabled={submitting}
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                 data-testid="platform-provider-list-cancel-button">
                  {t("common.cancel")}
                </Button>
                <Button disabled={submitting} type="submit" data-testid="platform-provider-list-save-button">
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  {submitting ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
