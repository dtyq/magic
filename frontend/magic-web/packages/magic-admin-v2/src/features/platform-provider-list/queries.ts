import { useQuery } from "@tanstack/react-query";
import type { ProviderCategory } from "@magic-admin-v2/features/platform-provider-list/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export const providerListKeys = {
  all: ["platform-provider-list"] as const,
  list: (category: ProviderCategory) => [...providerListKeys.all, "list", category] as const,
  detail: (id: string | null) => [...providerListKeys.all, "detail", id] as const,
  templates: (category?: ProviderCategory | null) =>
    [...providerListKeys.all, "templates", category ?? "all"] as const,
};

export function useProviderListQuery(
  category: ProviderCategory,
  options?: { enabled?: boolean; endpoint?: string; key?: string },
) {
  const endpoint = options?.endpoint;
  const key = options?.key ?? "platform";
  const { platformProviders } = useApis();

  return useQuery({
    enabled: options?.enabled ?? true,
    queryKey: [...providerListKeys.list(category), key],
    queryFn: ({ signal }) => platformProviders.getProviderList(category, endpoint, { signal }),
  });
}

export function useProviderDetailQuery(id: string | null, options?: { enabled?: boolean }) {
  const { platformProviders } = useApis();
  return useQuery({
    enabled: Boolean(id) && (options?.enabled ?? true),
    queryKey: providerListKeys.detail(id),
    queryFn: ({ signal }) => platformProviders.getProviderDetail(id ?? "", { signal }),
  });
}

export function useProviderTemplatesQuery(category?: ProviderCategory | null, enabled = true) {
  const { platformProviders } = useApis();
  return useQuery({
    enabled,
    queryKey: providerListKeys.templates(category),
    queryFn: ({ signal }) => platformProviders.getProviderTemplates(category, { signal }),
  });
}
