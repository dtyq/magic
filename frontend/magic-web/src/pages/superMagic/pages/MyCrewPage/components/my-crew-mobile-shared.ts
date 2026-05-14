import type { MyCrewView } from "@/services/crew/CrewService"
import type { MyCrewCrewTypeTab } from "../tab-state"

export type MyCrewMobileFilterType = "created" | "teamShared" | "fromMarket"

export interface MyCrewMobileFilterState {
	type: MyCrewMobileFilterType
}

export type MyCrewPresentationSource = "custom" | "teamShared" | "market"

export const MY_CREW_MOBILE_FILTER_DEFAULT: MyCrewMobileFilterState = {
	type: "created",
}

/** 将筛选项映射到现有主仓列表接口类型，确保移动端只走 API 已支持的分类。 */
export function resolveMyCrewListVariant(filterType: MyCrewMobileFilterType): MyCrewCrewTypeTab {
	if (filterType === "created") return "created"
	if (filterType === "teamShared") return "team-shared"
	return "hired"
}

/** 角标仅表示是否偏离默认分类，避免移动端继续伪装未支持的复合筛选能力。 */
export function countActiveMyCrewFilters(filter: MyCrewMobileFilterState) {
	return filter.type === MY_CREW_MOBILE_FILTER_DEFAULT.type ? 0 : 1
}

/** 统一派生移动端展示来源，避免列表与详情各自猜测 team-shared / market 语义。 */
export function resolveMyCrewPresentationSource(
	employee: Pick<MyCrewView, "sourceType" | "creatorName">,
	listVariant?: MyCrewCrewTypeTab | null,
): MyCrewPresentationSource {
	if (listVariant === "team-shared") return "teamShared"
	if (employee.sourceType === "LOCAL_CREATE") return "custom"
	if (employee.creatorName?.trim()) return "teamShared"
	return "market"
}
