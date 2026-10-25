import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@magic-admin-v2/components/searchable-multi-select";
import {
  slidesTemplateStatus,
  type SlidesTemplateTag,
} from "@magic-admin-v2/features/platform-slides-template/types";
import { resolveSlidesTemplateTagName } from "@magic-admin-v2/features/platform-slides-template/utils";

type SearchableTagSelectProps = {
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
  emptyLabel?: string;
  isLoading?: boolean;
  maxVisibleTags?: number;
  onChange: (value: string[]) => void;
  onOpenChange?: (open: boolean) => void;
  options: SlidesTemplateTag[];
  value: string[];
  triggerTestId?: string;
  contentTestId?: string;
  searchInputTestId?: string;
  searchClearButtonTestId?: string;
  optionTestId?: string;
  loadingTestId?: string;
  emptyTestId?: string;
  clearButtonTestId?: string;
};

export function SearchableTagSelect({
  ariaLabel,
  className,
  contentClassName,
  emptyLabel,
  isLoading = false,
  maxVisibleTags = 4,
  onChange,
  onOpenChange,
  options,
  value,
  triggerTestId,
  contentTestId,
  searchInputTestId,
  searchClearButtonTestId,
  optionTestId,
  loadingTestId,
  emptyTestId,
  clearButtonTestId,
}: SearchableTagSelectProps) {
  const { t } = useTranslation();
  const selectOptions = useMemo<SearchableMultiSelectOption[]>(
    () =>
      options.map((option) => {
        const disabled = option.status === slidesTemplateStatus.disabled;

        return {
          disabled,
          disabledLabel: disabled ? t("slidesTemplate.disabled") : undefined,
          label: resolveSlidesTemplateTagName(option),
          searchText: `${option.name_i18n.zh_CN} ${option.name_i18n.en_US}`,
          secondaryLabel: option.code,
          value: option.code,
        };
      }),
    [options, t],
  );

  return (
    <SearchableMultiSelect
      ariaLabel={ariaLabel ?? t("slidesTemplate.form.tags")}
      className={className}
      clearLabel={t("slidesTemplate.form.clearSelectedTags")}
      contentClassName={contentClassName}
      emptyLabel={emptyLabel ?? t("slidesTemplate.form.selectTags")}
      isLoading={isLoading}
      maxVisibleItems={maxVisibleTags}
      noMatchingLabel={t("slidesTemplate.form.noMatchingTags")}
      onChange={onChange}
      onOpenChange={onOpenChange}
      options={selectOptions}
      searchPlaceholder={t("slidesTemplate.form.searchTags")}
      selectedCountLabel={(count) =>
        t("slidesTemplate.form.selectedTagCount", { count })
      }
      value={value}
      triggerTestId={triggerTestId}
      contentTestId={contentTestId}
      searchInputTestId={searchInputTestId}
      searchClearButtonTestId={searchClearButtonTestId}
      optionTestId={optionTestId}
      loadingTestId={loadingTestId}
      emptyTestId={emptyTestId}
      clearButtonTestId={clearButtonTestId}
    />
  );
}
