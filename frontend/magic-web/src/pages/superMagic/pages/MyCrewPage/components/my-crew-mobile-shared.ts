import type { UnifiedAgentScope } from "@/apis/modules/crew"

export type MyCrewMobileFilterType = "all" | "created" | "teamShared" | "fromMarket"
export type MyCrewMobileSortType = "updated_at" | "created_at"

export interface MyCrewMobileFilterState {
	type: MyCrewMobileFilterType
	sort: MyCrewMobileSortType
}

export const MY_CREW_MOBILE_FILTER_DEFAULT: MyCrewMobileFilterState = {
	type: "all",
	sort: "updated_at",
}

/** Map the filter UI type to unified API scope parameter. */
export function resolveFilterScope(filterType: MyCrewMobileFilterType): UnifiedAgentScope {
	if (filterType === "created") return "created"
	if (filterType === "teamShared") return "team_shared"
	if (filterType === "fromMarket") return "market_installed"
	return "all"
}

/**
 * Badge count: type not "all" → +1, sort not "updated_at" → +1.
 * Returns 0 when filter matches defaults (no badge shown).
 */
export function countActiveMyCrewFilters(filter: MyCrewMobileFilterState): number {
	let count = 0
	if (filter.type !== "all") count++
	if (filter.sort !== "updated_at") count++
	return count
}
