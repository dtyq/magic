import { useQuery } from "@tanstack/react-query";
import type { OfficialStaffListParams } from "@magic-admin-v2/features/platform-official-staff/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export const platformOfficialStaffKeys = {
  all: ["platform-official-staff"] as const,
  agent: (code: string) => [...platformOfficialStaffKeys.all, "agent", code] as const,
  defaultAgent: () => [...platformOfficialStaffKeys.all, "default-agent"] as const,
  detail: (id: string) => [...platformOfficialStaffKeys.all, "detail", id] as const,
  list: (params: OfficialStaffListParams) =>
    [...platformOfficialStaffKeys.all, "list", params] as const,
  models: () => [...platformOfficialStaffKeys.all, "models"] as const,
};

const enabledStaffPageSize = 100;

export function useOfficialStaffListQuery(params: OfficialStaffListParams) {
  const { officialStaff } = useApis();
  return useQuery({
    queryKey: platformOfficialStaffKeys.list(params),
    queryFn: ({ signal }) => officialStaff.getOfficialStaffList(params, { signal }),
  });
}

export function useEnabledOfficialStaffListQuery() {
  const { officialStaff } = useApis();

  return useQuery({
    queryKey: [...platformOfficialStaffKeys.all, "enabled-list"],
    queryFn: async ({ signal }) => {
      const firstPage = await officialStaff.getOfficialStaffList(
        { page: 1, page_size: enabledStaffPageSize, status: 1 },
        { signal },
      );
      const pageCount = Math.ceil(firstPage.total / enabledStaffPageSize);

      if (pageCount <= 1) return firstPage.list;

      const remainingPages = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) =>
          officialStaff.getOfficialStaffList(
            { page: index + 2, page_size: enabledStaffPageSize, status: 1 },
            { signal },
          ),
        ),
      );

      return [firstPage, ...remainingPages].flatMap((page) => page.list);
    },
  });
}

export function useDefaultAgentSettingQuery() {
  const { officialStaff } = useApis();

  return useQuery({
    queryKey: platformOfficialStaffKeys.defaultAgent(),
    queryFn: ({ signal }) => officialStaff.getDefaultAgentSetting({ signal }),
  });
}

export function useOfficialStaffDetailQuery(id: string | null) {
  const { officialStaff } = useApis();
  return useQuery({
    enabled: Boolean(id),
    queryKey: platformOfficialStaffKeys.detail(id ?? ""),
    queryFn: ({ signal }) => officialStaff.getOfficialStaffDetail(id ?? "", { signal }),
  });
}

export function useAllStaffModelsQuery(enabled = true) {
  const { officialStaff } = useApis();
  return useQuery({
    enabled,
    queryKey: platformOfficialStaffKeys.models(),
    queryFn: ({ signal }) => officialStaff.getAllStaffModels({}, { signal }),
  });
}

export function useOfficialAgentDetailQuery(code: string | null, enabled = true) {
  const { officialStaff } = useApis();
  return useQuery({
    enabled: Boolean(code) && enabled,
    queryKey: platformOfficialStaffKeys.agent(code ?? ""),
    queryFn: ({ signal }) => officialStaff.getOfficialAgentDetail(code ?? "", { signal }),
    retry: false,
    staleTime: 0,
  });
}
