import { Brain, ImageIcon, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@magic-admin-v2/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs";
import {
  providerCategory,
  type ProviderCategory,
} from "@magic-admin-v2/features/platform-provider-list/types";

export function ProviderCategoryTabs({
  activeCategory,
  categories,
  onChange,
}: {
  activeCategory: ProviderCategory;
  categories: readonly ProviderCategory[];
  onChange: (category: ProviderCategory) => void;
}) {
  const { t } = useTranslation();

  return (
    <Tabs
      value={activeCategory}
      onValueChange={(value) => onChange(value as ProviderCategory)}
    >
      <TabsList>
        {categories.map((category) => (
          <TabsTrigger key={category} value={category} data-testid="platform-provider-list-tab-trigger">
            {t(`providerList.tab.${category}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function ProviderCategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: readonly ProviderCategory[];
  value: ProviderCategory;
  onChange: (value: ProviderCategory) => void;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue as ProviderCategory)}>
      <SelectTrigger className="w-full" data-testid="platform-provider-list-select-trigger">
        <SelectValue />
      </SelectTrigger>
      <SelectContent data-testid="platform-provider-list-select-content">
        {categories.map((category) => (
          <ProviderCategorySelectItem category={category} key={category} />
        ))}
      </SelectContent>
    </Select>
  );
}

function ProviderCategorySelectItem({ category }: { category: ProviderCategory }) {
  return (
    <SelectItem value={category} data-testid="platform-provider-list-option">
      <ProviderCategoryOptionContent category={category} />
    </SelectItem>
  );
}

export function ProviderCategoryOptionContent({ category }: { category: ProviderCategory }) {
  const { t } = useTranslation();
  const Icon =
    category === providerCategory.vlm ? ImageIcon : category === providerCategory.vgm ? Video : Brain;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{t(`providerList.category.${category}`)}</span>
    </span>
  );
}
