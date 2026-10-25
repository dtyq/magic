import { useQuery } from "@tanstack/react-query";
import type { AppMenuListParams } from "@magic-admin-v2/features/platform-app-menu/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export const appMenuKeys = {
  all: ["platform-app-menu"] as const,
  lists: () => [...appMenuKeys.all, "list"] as const,
  list: (params: AppMenuListParams) => [...appMenuKeys.lists(), params] as const,
  detail: (id: string) => [...appMenuKeys.all, "detail", id] as const,
};

export function useAppMenuListQuery(params: AppMenuListParams) {
  const { appMenu } = useApis();
  return useQuery({
    queryKey: appMenuKeys.list(params),
    queryFn: ({ signal }) => appMenu.getAppMenuList(params, { signal }),
  });
}

export function useAppMenuDetailQuery(id: string | null) {
  const { appMenu } = useApis();
  return useQuery({
    enabled: Boolean(id),
    queryKey: appMenuKeys.detail(id ?? ""),
    queryFn: ({ signal }) => appMenu.getAppMenuDetail(id ?? "", { signal }),
  });
}
