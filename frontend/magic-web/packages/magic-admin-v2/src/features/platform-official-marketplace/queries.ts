import { useQuery } from "@tanstack/react-query";
import type {
  AgentMarketCategoryListParams,
  AgentMarketListParams,
  SkillMarketCategoryListParams,
  SkillMarketListParams,
} from "@magic-admin-v2/features/platform-official-marketplace/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export const officialMarketplaceKeys = {
  all: ["platform-official-marketplace"] as const,
  employeeList: (params: AgentMarketListParams) =>
    [...officialMarketplaceKeys.all, "employee-list", params] as const,
  employeeLists: () => [...officialMarketplaceKeys.all, "employee-list"] as const,
  employeeCategories: (params?: AgentMarketCategoryListParams) =>
    [...officialMarketplaceKeys.all, "employee-categories", params] as const,
  employeeCategoryLists: () =>
    [...officialMarketplaceKeys.all, "employee-categories"] as const,
  skillList: (params: SkillMarketListParams) =>
    [...officialMarketplaceKeys.all, "skill-list", params] as const,
  skillLists: () => [...officialMarketplaceKeys.all, "skill-list"] as const,
  skillCategories: (params?: SkillMarketCategoryListParams) =>
    [...officialMarketplaceKeys.all, "skill-categories", params] as const,
  skillCategoryLists: () => [...officialMarketplaceKeys.all, "skill-categories"] as const,
};

export function useAgentMarketListQuery(params: AgentMarketListParams, enabled: boolean) {
  const { officialMarketplace } = useApis();
  return useQuery({
    enabled,
    queryKey: officialMarketplaceKeys.employeeList(params),
    queryFn: ({ signal }) => officialMarketplace.getAgentMarketList(params, { signal }),
  });
}

export function useAgentMarketCategoryListQuery(
  params: AgentMarketCategoryListParams,
  enabled = true,
) {
  const { officialMarketplace } = useApis();
  return useQuery({
    enabled,
    queryKey: officialMarketplaceKeys.employeeCategories(params),
    queryFn: ({ signal }) => officialMarketplace.getAgentMarketCategoryList(params, { signal }),
  });
}

export function useSkillMarketListQuery(params: SkillMarketListParams, enabled: boolean) {
  const { officialMarketplace } = useApis();
  return useQuery({
    enabled,
    queryKey: officialMarketplaceKeys.skillList(params),
    queryFn: ({ signal }) => officialMarketplace.getSkillMarketList(params, { signal }),
  });
}

export function useSkillMarketCategoryListQuery(
  params: SkillMarketCategoryListParams,
  enabled = true,
) {
  const { officialMarketplace } = useApis();
  return useQuery({
    enabled,
    queryKey: officialMarketplaceKeys.skillCategories(params),
    queryFn: ({ signal }) => officialMarketplace.getSkillMarketCategoryList(params, { signal }),
  });
}
