import { useQuery } from "@tanstack/react-query";
import { isPlatformPermissionDeniedError } from "@magic-admin-v2/api/types";
import { createDefaultPlatformInfoDetails } from "@magic-admin-v2/features/platform-info/api";
import { useRuntime } from "@magic-admin-v2/runtime/context";

export const platformInfoKeys = {
  all: ["platform-info"] as const,
  detail: () => [...platformInfoKeys.all, "detail"] as const,
};

export function usePlatformInfoQuery() {
  const { access, platformInfo: hostPlatformInfo, apis: { platformInfo } } = useRuntime();

  return useQuery({
    queryKey: platformInfoKeys.detail(),
    enabled: Boolean(access),
    // Host bootstrap data does not include the editable Agent prompt fields.
    // Always reconcile it with the platform-info endpoint when this query mounts.
    refetchOnMount: "always",
    initialData: hostPlatformInfo,
    queryFn: async ({ signal }) => {
      try {
        return await platformInfo.getPlatformInfo({
          signal,
          enableErrorMessagePrompt: false,
        });
      } catch (error) {
        if (isPlatformPermissionDeniedError(error)) {
          return hostPlatformInfo ?? createDefaultPlatformInfoDetails();
        }
        throw error;
      }
    },
  });
}
