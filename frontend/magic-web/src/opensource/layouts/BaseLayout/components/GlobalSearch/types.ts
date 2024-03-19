/** 搜索模块审批状态 */
export const enum SearchApprovalStatus {
	All = "all",
	UnderApproval = "2",
	Approved = "11",
	Rejected = "5",
	// Disallow = "",
	Revoked = "3",
}

/** 搜索模块日期状态 */
export const enum SearchMessageDate {
	UnrestrictedTime = "unrestrictedTime",
	Today = "today",
	AlmostAWeek = "almostAWeek",
	AlmostAMonth = "almostAMonth",
}
