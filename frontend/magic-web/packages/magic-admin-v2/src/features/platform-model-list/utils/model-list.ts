import {
  providerModelCategory,
  providerModelType,
  type ProviderModelCategory,
  type ProviderModelGroupQueryParams,
  type ProviderModelStatus,
  type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types";
import { toProviderModelApiCategories } from "@magic-admin-v2/features/platform-model-list/utils/permissions";

export const pageSize = 20;
export const allCategoriesTab = "all" as const;
export const allStatusFilterValue = "all" as const;

export const modelTypesByCategory: Record<ProviderModelCategory, ProviderModelType[]> = {
  [providerModelCategory.llm]: [providerModelType.largeLanguageModel],
  [providerModelCategory.vlm]: [
    providerModelType.textToImage,
    providerModelType.imageToImage,
    providerModelType.imageEnhancement,
  ],
  [providerModelCategory.vgm]: [providerModelType.textToVideo],
  [providerModelCategory.embedding]: [providerModelType.embedding],
};

export type ModelCategoryTab = typeof allCategoriesTab | ProviderModelCategory;

export type ModelListFilterDraft = {
  keyword: string;
  modelTypes: ProviderModelType[];
  status: ProviderModelStatus | null;
};

export type FilterOption<T extends string | number> = {
  label: string;
  value: T;
};

export function createDefaultFilterDraft(keyword = ""): ModelListFilterDraft {
  return {
    keyword,
    modelTypes: [],
    status: null,
  };
}

export function getModelListFilterActiveCount(filter: ModelListFilterDraft) {
  return (
    Number(Boolean(filter.keyword.trim())) +
    Number(filter.modelTypes.length > 0) +
    Number(filter.status !== null)
  );
}

export function toQueryParams(
  filterDraft: ModelListFilterDraft,
  activeCategory: ModelCategoryTab,
  accessibleCategories: readonly ProviderModelCategory[],
  page = 1,
  serviceProviderConfigId = "",
  pageSize = 20,
): ProviderModelGroupQueryParams {
  const isEmbeddingTab = activeCategory === providerModelCategory.embedding;
  const isLlmTab = activeCategory === providerModelCategory.llm;
  const allowedModelTypes = activeCategory === allCategoriesTab
    ? accessibleCategories.flatMap((category) => modelTypesByCategory[category])
    : modelTypesByCategory[activeCategory];

  return {
    keyword: filterDraft.keyword.trim(),
    categories: activeCategory === allCategoriesTab
      ? toProviderModelApiCategories(accessibleCategories)
      : [isEmbeddingTab ? providerModelCategory.llm : activeCategory],
    model_types: isEmbeddingTab
      ? [providerModelType.embedding]
      : isLlmTab
        ? [providerModelType.largeLanguageModel]
        : filterDraft.modelTypes.filter((modelType) => allowedModelTypes.includes(modelType)),
    statuses: filterDraft.status === null ? [] : [filterDraft.status],
    service_provider_config_ids: serviceProviderConfigId ? [serviceProviderConfigId] : [],
    page,
    page_size: pageSize,
  };
}

export function resolveModelCategoryTab(
  selectedCategory: ModelCategoryTab,
  accessibleCategories: readonly ProviderModelCategory[],
): ModelCategoryTab {
  if (selectedCategory === allCategoriesTab) {
    return allCategoriesTab;
  }

  return accessibleCategories.includes(selectedCategory)
    ? selectedCategory
    : accessibleCategories[0] ?? allCategoriesTab;
}

export function restrictQueryParamsToAccess(
  params: ProviderModelGroupQueryParams,
  accessibleCategories: readonly ProviderModelCategory[],
): ProviderModelGroupQueryParams {
  const accessibleApiCategories = toProviderModelApiCategories(accessibleCategories);
  const requestedCategories = params.categories.filter((category) =>
    accessibleApiCategories.includes(category),
  );
  const categories = requestedCategories.length
    ? requestedCategories
    : accessibleApiCategories;
  const allowedModelTypes = accessibleCategories
    .filter((category) =>
      categories.includes(
        category === providerModelCategory.embedding
          ? providerModelCategory.llm
          : category,
      ),
    )
    .flatMap((category) => modelTypesByCategory[category]);
  const requestedModelTypes = params.model_types.filter((modelType) =>
    allowedModelTypes.includes(modelType),
  );

  return {
    ...params,
    categories,
    model_types: params.model_types.length && requestedModelTypes.length
      ? requestedModelTypes
      : Array.from(new Set(allowedModelTypes)),
  };
}

export function getCreateModelDefaults(
  activeCategory: ModelCategoryTab,
  editableCategories: readonly ProviderModelCategory[],
): {
  category?: ProviderModelCategory;
  modelType?: ProviderModelType;
} {
  const createCategory = activeCategory !== allCategoriesTab
    && editableCategories.includes(activeCategory)
    ? activeCategory
    : editableCategories[0];

  switch (createCategory) {
    case providerModelCategory.embedding:
      return {
        category: providerModelCategory.llm,
        modelType: providerModelType.embedding,
      };
    case providerModelCategory.llm:
      return {
        category: providerModelCategory.llm,
        modelType: providerModelType.largeLanguageModel,
      };
    case providerModelCategory.vlm:
      return {
        category: providerModelCategory.vlm,
        modelType: providerModelType.textToImage,
      };
    case providerModelCategory.vgm:
      return {
        category: providerModelCategory.vgm,
        modelType: providerModelType.textToVideo,
      };
    default:
      return {};
  }
}
