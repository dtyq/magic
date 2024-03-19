export const enum MemberCardTab {
	BaseInfo = "baseInfo",
	EmployeeProfile = "employeeProfile",
	EmploymentInfo = "employmentInfo",
}

/**
 * Get member card tab options
 */
export function getMemberCardTabOptions(t: (key: string) => string) {
	return [
		{ label: t("memberCard.baseInfo"), value: MemberCardTab.BaseInfo },
		// { label: t("memberCard.employeeProfile"), value: MemberCardTab.EmployeeProfile },
		// { label: t("memberCard.employmentInfo"), value: MemberCardTab.EmploymentInfo },
	]
}
