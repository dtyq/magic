import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Badge } from "@magic-admin-v2/components/ui/badge";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@magic-admin-v2/components/ui/form";
import { Input } from "@magic-admin-v2/components/ui/input";
import { Switch } from "@magic-admin-v2/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs";
import { ProviderCategoryOptionContent } from "@magic-admin-v2/features/platform-provider-list/components/provider-category-controls";
import { ProviderIcon } from "@magic-admin-v2/features/platform-provider-list/components/provider-list-content";
import type {
  ProviderFormValues,
  ProviderListItem,
  ProviderTemplate,
} from "@magic-admin-v2/features/platform-provider-list/types";
import {
  Language,
  type Language as LanguageCode,
} from "@magic-admin-v2/i18n/resources";

export function ProviderAliasLanguageFields({
  disabled = false,
  form,
}: {
  disabled?: boolean;
  form: UseFormReturn<ProviderFormValues>;
}) {
  const { t } = useTranslation();
  const [activeLocale, setActiveLocale] = useState<LanguageCode>(Language.ZhCN);
  const alias = form.watch("alias");
  const aliasEn = form.watch("alias_en");
  const completion = {
    zh_CN: alias.trim().length > 0,
    en_US: aliasEn.trim().length > 0,
  };

  return (
    <Tabs value={activeLocale} onValueChange={(value) => setActiveLocale(value as LanguageCode)}>
      <div className="flex h-11 flex-wrap items-center gap-3">
        <span className="shrink-0 text-sm font-medium text-muted-foreground">
          {t("providerList.language")}
        </span>
        <TabsList className="h-11 shrink-0">
          {([Language.ZhCN, Language.EnUS] as const).map((locale) => (
            <TabsTrigger className="h-11 gap-2" key={locale} value={locale} data-testid="platform-provider-list-tab-trigger">
              <span>{locale === Language.ZhCN ? t("language.zhCN") : t("language.enUS")}</span>
              <Badge className="h-5 px-1.5 text-[11px] leading-none shadow-none" variant="secondary">
                {completion[locale]
                  ? t("providerList.contentLanguage.complete")
                  : t("providerList.contentLanguage.incomplete")}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent className="!mt-4 data-[state=inactive]:hidden" value={Language.ZhCN}>
        <FormField
          control={form.control}
          name="alias"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("providerList.field.alias")}</FormLabel>
              <FormControl>
                <Input
                  disabled={disabled}
                  placeholder={t("providerList.placeholder.alias")}
                  {...field}
                data-testid="platform-provider-list-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TabsContent>
      <TabsContent className="!mt-4 data-[state=inactive]:hidden" value={Language.EnUS}>
        <FormField
          control={form.control}
          name="alias_en"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("providerList.field.aliasEn")}</FormLabel>
              <FormControl>
                <Input
                  disabled={disabled}
                  placeholder={t("providerList.placeholder.aliasEn")}
                  {...field}
                data-testid="platform-provider-list-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TabsContent>
    </Tabs>
  );
}

export function ProviderFooterStatusSwitch({
  disabled = false,
  form,
}: {
  disabled?: boolean;
  form: UseFormReturn<ProviderFormValues>;
}) {
  const { t } = useTranslation();

  return (
    <FormField
      control={form.control}
      name="status"
      render={({ field }) => (
        <FormItem className="flex min-h-9 items-center gap-3">
          <FormLabel className="m-0 text-sm">{t("providerList.field.status")}</FormLabel>
          <FormControl>
            <Switch disabled={disabled} checked={field.value} onCheckedChange={field.onChange} data-testid="platform-provider-list-switch" />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function ProviderSortField({
  disabled = false,
  form,
}: {
  disabled?: boolean;
  form: UseFormReturn<ProviderFormValues>;
}) {
  const { t } = useTranslation();

  return (
    <FormField
      control={form.control}
      name="sort"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("providerList.field.sort")}</FormLabel>
          <FormControl>
            <Input
              disabled={disabled}
              inputMode="numeric"
              min={0}
              onBlur={field.onBlur}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                field.onChange(Number.isNaN(value) ? 0 : value);
              }}
              ref={field.ref}
              step={1}
              type="number"
              value={field.value}
            data-testid="platform-provider-list-input" />
          </FormControl>
          <FormDescription>{t("providerList.fieldDesc.sort")}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function ProviderReadonlyIdentity({ provider }: { provider: ProviderListItem }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <span className="text-sm font-medium leading-none">
          {t("providerList.field.category")}
        </span>
        <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">
          <ProviderCategoryOptionContent category={provider.category} />
        </div>
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium leading-none">
          {t("providerList.field.template")}
        </span>
        <div className="flex min-h-9 items-center rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
          <ProviderTemplateOptionContent provider={provider} />
        </div>
      </div>
    </div>
  );
}

export function ProviderTemplateSelectValue({
  placeholder,
  template,
}: {
  placeholder: string;
  template: ProviderTemplate | null;
}) {
  if (!template) {
    return <span className="text-muted-foreground">{placeholder}</span>;
  }

  return (
    <div className="inline-flex min-w-0 items-center gap-2">
      <ProviderIcon provider={template} size="sm" />
      <span className="truncate">{template.name}</span>
    </div>
  );
}

export function ProviderTemplateOptionContent({
  provider,
}: {
  provider: ProviderListItem | ProviderTemplate;
}) {
  const secondary =
    "remark" in provider && provider.remark ? provider.remark : provider.provider_code;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <ProviderIcon provider={provider} size="sm" />
      <span className="min-w-0">
        <span className="block truncate leading-5">{provider.name}</span>
        {secondary ? (
          <span className="block truncate text-[11px] leading-4 text-muted-foreground">
            {secondary}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function ProviderRequiredMark() {
  return <span className="ml-1 text-destructive">*</span>;
}
