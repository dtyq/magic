import { useQuery } from "@tanstack/react-query"
import { useApis } from "@magic-admin-v2/runtime/context"

export const platformSystemCapabilityKeys = {
	all: ["platform-system-capabilities"] as const,
	list: () => [...platformSystemCapabilityKeys.all, "list"] as const,
	detail: (code: string) => [...platformSystemCapabilityKeys.all, "detail", code] as const,
	models: (code: string) => [...platformSystemCapabilityKeys.all, "models", code] as const,
}

export function useSystemCapabilityListQuery() {
	const { systemCapabilities } = useApis()
	return useQuery({
		queryKey: platformSystemCapabilityKeys.list(),
		queryFn: ({ signal }) => systemCapabilities.getSystemCapabilityList({ signal }),
	})
}

export function useSystemCapabilityDetailQuery(code: string | null) {
	const { systemCapabilities } = useApis()
	return useQuery({
		enabled: Boolean(code),
		queryKey: platformSystemCapabilityKeys.detail(code ?? ""),
		queryFn: ({ signal }) =>
			systemCapabilities.getSystemCapabilityDetail(code ?? "", { signal }),
	})
}

export function useCapabilityModelsQuery(code: string | null, enabled = true) {
	const { systemCapabilities } = useApis()
	return useQuery({
		enabled: Boolean(code) && enabled,
		queryKey: platformSystemCapabilityKeys.models(code ?? ""),
		queryFn: ({ signal }) => systemCapabilities.getCapabilityModels(code ?? "", { signal }),
	})
}
