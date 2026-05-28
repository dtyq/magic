import type { ShareScopeInfo } from "../types"

type ShareScopeTranslator = (key: string, values?: Record<string, unknown>) => string

/**
 * Returns true when the organization share covers all members (no designated targets).
 */
export function isOrganizationShareScopeAll(shareScope: ShareScopeInfo | undefined): boolean {
	return shareScope?.type === "all"
}

/**
 * Builds the organization share scope summary for list/detail subtitles.
 * When type is "all", shows all-members copy; otherwise shows member/department counts or a fallback.
 */
export function formatOrganizationShareScopeSummary(
	shareScope: ShareScopeInfo | undefined,
	t: ShareScopeTranslator,
): string {
	if (isOrganizationShareScopeAll(shareScope)) {
		return t("projectShare.shareScopeAllMembers")
	}

	const userCount = shareScope?.user_count || 0
	const departmentCount = shareScope?.department_count || 0

	if (userCount > 0 && departmentCount > 0) {
		return t("projectShare.manageOrganizationMembersAndDepartments", {
			userCount,
			departmentCount,
		})
	}

	if (userCount > 0) {
		return t("projectShare.manageOrganizationMembersOnly", { userCount })
	}

	if (departmentCount > 0) {
		return t("projectShare.manageOrganizationDepartmentsOnly", { departmentCount })
	}

	return t("projectShare.manageOrganizationSummary")
}
