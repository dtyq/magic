import { useMutation, useQueryClient } from "@tanstack/react-query";
import { providerListKeys } from "@magic-admin-v2/features/platform-provider-list/queries";
import type {
  AddProviderParams,
  UpdateProviderParams,
} from "@magic-admin-v2/features/platform-provider-list/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export function useAddProviderMutation() {
  const queryClient = useQueryClient();
  const { platformProviders } = useApis();

  return useMutation({
    mutationFn: (values: AddProviderParams) => platformProviders.addProvider(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerListKeys.all }),
  });
}

export function useUpdateProviderMutation() {
  const queryClient = useQueryClient();
  const { platformProviders } = useApis();

  return useMutation({
    mutationFn: (values: UpdateProviderParams) => platformProviders.updateProvider(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: providerListKeys.all }),
  });
}

export function useDeleteProviderMutation() {
  const queryClient = useQueryClient();
  const { platformProviders } = useApis();

  return useMutation({
    mutationFn: (id: string) => platformProviders.deleteProvider(id),
    // Stop any in-flight detail request and remove its cache before the backend invalidates the ID.
    // This protects the flow even if a delete is triggered from a list row rather than the detail.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: providerListKeys.detail(id) });
      queryClient.removeQueries({ queryKey: providerListKeys.detail(id) });
    },
    // Refresh only provider lists. Refetching the deleted detail ID is invalid on the backend.
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: providerListKeys.all,
        predicate: ({ queryKey }) => queryKey[1] === "list",
      }),
  });
}
