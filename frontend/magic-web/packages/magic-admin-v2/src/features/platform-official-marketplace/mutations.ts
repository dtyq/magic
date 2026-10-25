import { useMutation, useQueryClient } from "@tanstack/react-query";
import { officialMarketplaceKeys } from "@magic-admin-v2/features/platform-official-marketplace/queries";
import type {
  AgentMarketItem,
  SaveAgentMarketCategoryParams,
  SaveSkillMarketCategoryParams,
  SkillMarketItem,
  UpdateMarketInfoParams,
  WithPage,
} from "@magic-admin-v2/features/platform-official-marketplace/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export function useUpdateAgentMarketInfoMutation() {
  const queryClient = useQueryClient();
  const { officialMarketplace } = useApis();

  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateMarketInfoParams }) =>
      officialMarketplace.updateAgentMarketInfo(id, values),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: officialMarketplaceKeys.employeeLists() }),
  });
}

export function useAgentMarketCategoryMutations() {
  const queryClient = useQueryClient();
  const { officialMarketplace } = useApis();
  const invalidateCategoryData = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: officialMarketplaceKeys.employeeCategoryLists(),
      }),
      queryClient.invalidateQueries({ queryKey: officialMarketplaceKeys.employeeLists() }),
    ]);

  return {
    create: useMutation({
      mutationFn: (values: SaveAgentMarketCategoryParams) =>
        officialMarketplace.createAgentMarketCategory(values),
      onSuccess: invalidateCategoryData,
    }),
    delete: useMutation({
      mutationFn: (id: string) => officialMarketplace.deleteAgentMarketCategory(id),
      onSuccess: invalidateCategoryData,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        values,
      }: {
        id: string;
        values: SaveAgentMarketCategoryParams;
      }) => officialMarketplace.updateAgentMarketCategory(id, values),
      onSuccess: invalidateCategoryData,
    }),
  };
}

export function useUpdateAgentMarketCategoryRelationMutation() {
  const queryClient = useQueryClient();
  const { officialMarketplace } = useApis();

  return useMutation({
    mutationFn: ({ id, categoryIds }: { id: string; categoryIds: string[] }) =>
      officialMarketplace.updateAgentMarketCategoryRelation(id, categoryIds),
    onSuccess: async (_data, { categoryIds, id }) => {
      queryClient.setQueriesData<WithPage<AgentMarketItem>>(
        { queryKey: officialMarketplaceKeys.employeeLists() },
        (previous) =>
          previous
            ? {
                ...previous,
                list: previous.list.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        category_id: categoryIds[0] ?? null,
                        category_ids: categoryIds,
                      }
                    : item,
                ),
              }
            : previous,
      );
      await queryClient.invalidateQueries({
        queryKey: officialMarketplaceKeys.employeeLists(),
      });
    },
  });
}

export function useUpdateSkillMarketInfoMutation() {
  const queryClient = useQueryClient();
  const { officialMarketplace } = useApis();

  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateMarketInfoParams }) =>
      officialMarketplace.updateSkillMarketInfo(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: officialMarketplaceKeys.all }),
  });
}

export function useSkillMarketCategoryMutations() {
  const queryClient = useQueryClient();
  const { officialMarketplace } = useApis();
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: officialMarketplaceKeys.skillCategoryLists() }),
      queryClient.invalidateQueries({ queryKey: officialMarketplaceKeys.skillLists() }),
    ]);

  return {
    create: useMutation({
      mutationFn: (values: SaveSkillMarketCategoryParams) =>
        officialMarketplace.createSkillMarketCategory(values),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: string; values: SaveSkillMarketCategoryParams }) =>
        officialMarketplace.updateSkillMarketCategory(id, values),
      onSuccess: invalidate,
    }),
    delete: useMutation({
      mutationFn: (id: string) => officialMarketplace.deleteSkillMarketCategory(id),
      onSuccess: invalidate,
    }),
  };
}

export function useUpdateSkillMarketCategoryRelationMutation() {
  const queryClient = useQueryClient();
  const { officialMarketplace } = useApis();

  return useMutation({
    mutationFn: ({ id, categoryIds }: { id: string; categoryIds: string[] }) =>
      officialMarketplace.updateSkillMarketCategoryRelation(id, categoryIds),
    onSuccess: async (_data, { id, categoryIds }) => {
      queryClient.setQueriesData<WithPage<SkillMarketItem>>(
        { queryKey: officialMarketplaceKeys.skillLists() },
        (previous) =>
          previous
            ? {
                ...previous,
                list: previous.list.map((item) =>
                  item.id === id
                    ? { ...item, category_id: categoryIds[0] ?? null, category_ids: categoryIds }
                    : item,
                ),
              }
            : previous,
      );
      await queryClient.invalidateQueries({ queryKey: officialMarketplaceKeys.skillLists() });
    },
  });
}
