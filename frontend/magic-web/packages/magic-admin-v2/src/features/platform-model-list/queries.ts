import { useQuery } from "@tanstack/react-query";
import type { ProviderModelGroupQueryParams } from "@magic-admin-v2/features/platform-model-list/types";
import { useProviderModelDataSource } from "@magic-admin-v2/features/platform-model-list/utils/data-source";
import { useApis } from "@magic-admin-v2/runtime/context";

export const providerModelListKeys = {
  all: (dataSourceKey = "platform") => ["platform-model-list", dataSourceKey] as const,
  list: (dataSourceKey: string, params: ProviderModelGroupQueryParams) =>
    [...providerModelListKeys.all(dataSourceKey), "list", params] as const,
  originalModelIds: (dataSourceKey: string) =>
    [...providerModelListKeys.all(dataSourceKey), "original-model-ids"] as const,
  pricingTemplates: (dataSourceKey: string, category: string, providerCode: string) =>
    [...providerModelListKeys.all(dataSourceKey), "pricing-templates", category, providerCode] as const,
};

export function useProviderModelGroupsQuery(
  params: ProviderModelGroupQueryParams,
  options?: { enabled?: boolean },
) {
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useQuery({
    queryKey: providerModelListKeys.list(dataSource.key, params),
    queryFn: ({ signal }) => platformModel.getProviderModelGroups(params, dataSource, { signal }),
    enabled: options?.enabled ?? true,
  });
}

export function useProviderOriginalModelIdsQuery() {
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useQuery({
    queryKey: providerModelListKeys.originalModelIds(dataSource.key),
    queryFn: ({ signal }) => platformModel.getProviderOriginalModelIds(dataSource, { signal }),
  });
}

export function useProviderModelPricingTemplatesQuery({
  category,
  providerCode,
}: {
  category: string;
  providerCode?: string;
}) {
  const dataSource = useProviderModelDataSource();
  const { platformModel } = useApis();

  return useQuery({
    queryKey: providerModelListKeys.pricingTemplates(dataSource.key, category, providerCode ?? ""),
    queryFn: ({ signal }) =>
      platformModel.getProviderModelPricingTemplates(
        { category, providerCode: providerCode ?? "" },
        dataSource,
        { signal },
      ),
    enabled: Boolean(category && providerCode && dataSource.endpoints.modelPricingTemplates),
  });
}
