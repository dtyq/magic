import { useMutation, useQueryClient } from "@tanstack/react-query";
import { platformInfoKeys } from "@magic-admin-v2/features/platform-info/queries";
import type { UpdatePlatformInfoParams } from "@magic-admin-v2/features/platform-info/types";
import { useApis } from "@magic-admin-v2/runtime/context";

export function useUpdatePlatformInfoMutation() {
  const queryClient = useQueryClient();
  const { platformInfo } = useApis();

  return useMutation({
    mutationFn: (params: Partial<UpdatePlatformInfoParams>) =>
      platformInfo.updatePlatformInfo(params),
    onSuccess: (data) => queryClient.setQueryData(platformInfoKeys.detail(), data),
  });
}
