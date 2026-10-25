import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field";
import { FieldError } from "@magic-admin-v2/components/form/field-error";
import { Badge } from "@magic-admin-v2/components/ui/badge";
import { Input } from "@magic-admin-v2/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs";
import { Textarea } from "@magic-admin-v2/components/ui/textarea";
import type { ModelEditorValues } from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema";
import { getErrorMessage } from "@magic-admin-v2/features/platform-model-list/utils/model-editor";
import {
  Language,
  type Language as LanguageCode,
} from "@magic-admin-v2/i18n/resources";

export function ModelContentLanguageFields({
  activeLocale,
  disabled,
  form,
  onLocaleChange,
}: {
  activeLocale: LanguageCode;
  disabled: boolean;
  form: UseFormReturn<ModelEditorValues>;
  onLocaleChange: (locale: LanguageCode) => void;
}) {
  const { t } = useTranslation();
  const name = form.watch("name");
  const nameEn = form.watch("name_en");
  const description = form.watch("description");
  const descriptionEn = form.watch("description_en");
  const completion = {
    zh_CN: Boolean(name.trim() || description.trim()),
    en_US: Boolean(nameEn.trim() || descriptionEn.trim()),
  };

  return (
    <Tabs
      onValueChange={(value) => onLocaleChange(value as LanguageCode)}
      value={activeLocale}
    >
      <div className="flex h-11 flex-wrap items-center gap-3">
        <span className="shrink-0 text-sm font-medium text-muted-foreground">
          {t("modelList.editor.language")}
        </span>
        <TabsList className="h-11 shrink-0">
            {([Language.ZhCN, Language.EnUS] as const).map((locale) => (
              <TabsTrigger className="h-11 gap-2" key={locale} value={locale} data-testid="platform-model-list-tab-trigger">
                <span>{locale === Language.ZhCN ? t("language.zhCN") : t("language.enUS")}</span>
                <Badge className="h-5 px-1.5 text-[11px] leading-none shadow-none" variant="secondary">
                  {completion[locale]
                    ? t("modelList.editor.contentLanguage.complete")
                    : t("modelList.editor.contentLanguage.incomplete")}
                </Badge>
              </TabsTrigger>
            ))}
        </TabsList>
      </div>
      <TabsContent className="!mt-4 grid gap-4 data-[state=inactive]:hidden" value={Language.ZhCN}>
          <DialogFormField fieldId="name" label={t("modelList.editor.field.name")} required>
            <Input
              disabled={disabled}
              id="name"
              placeholder={t("modelList.editor.placeholder.name")}
              {...form.register("name")}
            data-testid="platform-model-list-name-input" />
            <FieldError
              className="text-sm"
              message={getErrorMessage(form.formState.errors.name?.message)}
            />
          </DialogFormField>
          <DialogFormField fieldId="description" label={t("modelList.editor.field.description")}>
            <Textarea
              disabled={disabled}
              id="description"
              placeholder={t("modelList.editor.placeholder.description")}
              rows={3}
              {...form.register("description")}
            data-testid="platform-model-list-description-input" />
          </DialogFormField>
      </TabsContent>
      <TabsContent className="!mt-4 grid gap-4 data-[state=inactive]:hidden" value={Language.EnUS}>
          <DialogFormField fieldId="name_en" label={t("modelList.editor.field.nameEn")}>
            <Input
              disabled={disabled}
              id="name_en"
              placeholder={t("modelList.editor.placeholder.nameEn")}
              {...form.register("name_en")}
            data-testid="platform-model-list-name-en-input" />
            <FieldError
              className="text-sm"
              message={getErrorMessage(form.formState.errors.name_en?.message)}
            />
          </DialogFormField>
          <DialogFormField fieldId="description_en" label={t("modelList.editor.field.descriptionEn")}>
            <Textarea
              disabled={disabled}
              id="description_en"
              placeholder={t("modelList.editor.placeholder.descriptionEn")}
              rows={3}
              {...form.register("description_en")}
            data-testid="platform-model-list-description-en-input" />
          </DialogFormField>
      </TabsContent>
    </Tabs>
  );
}
