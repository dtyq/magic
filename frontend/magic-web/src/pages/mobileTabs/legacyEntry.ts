import { MobileTabParam } from "./constants"

/**
 * Legacy mobile home lived under /mobile-tabs. Only redirect the old home entry,
 * not tab-specific or deep-link variants that still carry route state.
 */
export function isLegacyMobileTabsHomeEntry(pathname: string, search: string): boolean {
	if (!/\/mobile-tabs\/?$/.test(pathname)) {
		return false
	}

	const searchParams = new URLSearchParams(search)
	if (
		searchParams.has("workspaceId") ||
		searchParams.has("projectId") ||
		searchParams.has("topicId")
	) {
		return false
	}

	const tabParam = searchParams.get("tab")
	return !tabParam || tabParam === MobileTabParam.Super
}