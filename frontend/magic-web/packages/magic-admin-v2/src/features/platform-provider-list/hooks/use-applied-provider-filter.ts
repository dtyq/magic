import { useDebounce } from "ahooks"
import { useMemo } from "react"
import { TEXT_FILTER_DEBOUNCE_MS } from "@magic-admin-v2/constants/filters"
import type { ProviderFilterDraft } from "@magic-admin-v2/features/platform-provider-list/utils/provider-list"

/** Debounces one text condition; clearing the input applies immediately. */
function useAppliedText(value: string) {
	const normalized = value.trim()
	const debounced = useDebounce(normalized, { wait: TEXT_FILTER_DEBOUNCE_MS })

	return normalized ? debounced : ""
}

/**
 * Derives the filter used for client-side provider filtering.
 *
 * Name, alias and provider ID are independent text conditions, so each one is
 * debounced separately while the select filters apply immediately.
 */
export function useAppliedProviderFilter(filterDraft: ProviderFilterDraft): ProviderFilterDraft {
	const name = useAppliedText(filterDraft.name)
	const alias = useAppliedText(filterDraft.alias)
	const providerId = useAppliedText(filterDraft.id)

	return useMemo(
		() => ({ ...filterDraft, name, alias, id: providerId }),
		[alias, filterDraft, name, providerId],
	)
}
