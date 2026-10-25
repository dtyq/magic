import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appMenuKeys } from "@magic-admin-v2/features/platform-app-menu/queries";
import type { AppMenuFormState, AppMenuStatus } from "@magic-admin-v2/features/platform-app-menu/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export function useSaveAppMenuMutation() {
  const queryClient = useQueryClient();
  const { appMenu } = useApis();

  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: AppMenuFormState }) =>
      appMenu.saveAppMenu(values, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appMenuKeys.all }),
  });
}

export function useDeleteAppMenuMutation() {
  const queryClient = useQueryClient();
  const { appMenu } = useApis();

  return useMutation({
    mutationFn: (id: string) => appMenu.deleteAppMenu(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appMenuKeys.all }),
  });
}

export function useUpdateAppMenuStatusMutation() {
  const queryClient = useQueryClient();
  const { appMenu } = useApis();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppMenuStatus }) =>
      appMenu.updateAppMenuStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appMenuKeys.all }),
  });
}
