import { useMutation, useQueryClient } from "@tanstack/react-query"
import { platformSystemCapabilityKeys } from "@magic-admin-v2/features/platform-system-capabilities/queries"
import type {
	TestAiPowerConnectionParams,
	UpdateAiPowerParams,
} from "@magic-admin-v2/features/platform-system-capabilities/types"
import { useApis } from "@magic-admin-v2/runtime/context"

export function useUpdateSystemCapabilityMutation() {
	const queryClient = useQueryClient()
	const { systemCapabilities } = useApis()

	return useMutation({
		mutationFn: (params: UpdateAiPowerParams) =>
			systemCapabilities.updateSystemCapability(params),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: platformSystemCapabilityKeys.all }),
	})
}

export function useTestSystemCapabilityConnectionMutation() {
	const { systemCapabilities } = useApis()
	return useMutation({
		mutationFn: (params: TestAiPowerConnectionParams) =>
			systemCapabilities.testSystemCapabilityConnection(params),
	})
}
