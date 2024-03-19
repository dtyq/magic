// 状态
export const Status = {
	enable: 7,
	disable: 8,
}

// 审批流状态
export const Approvaltatus = {
	// 待审批
	pending: 1,
	// 审批中
	inprogress: 2,
	// 已通过
	pass: 3,
	// 已拒绝
	reject: 4,
}

// 审批流状态
export const ApprovalStatusMap = {
	[Approvaltatus.pending]: "待审批",
	[Approvaltatus.inprogress]: "审批中",
	[Approvaltatus.pass]: "已通过",
	[Approvaltatus.reject]: "不通过",
}

// 企业发布状态
export const EntrepriseStatus = {
	// 未发布
	unrelease: 5,
	// 已发布
	release: 6,
}

// 企业发布状态
export const EntrepriseStatusMap = {
	[EntrepriseStatus.unrelease]: "未发布",
	[EntrepriseStatus.release]: "已发布",
}

// 平台发布状态
export const PlatformStatus = {
	// 未上架
	unrelease: 9,
	// 审核中
	audit: 10,
	// 已上架
	release: 11,
}

// 平台发布状态
export const PlatformStatusMap = {
	[PlatformStatus.unrelease]: "未上架",
	[PlatformStatus.audit]: "审核中",
	[PlatformStatus.release]: "已上架",
}

/**
 * AI助理可操作项
 */
export const MenuKeys = {
	/** 查看版本记录 */
	VersionRecord: 0,
	/** 修改 */
	UpdateItem: 1,
	/** 发布 */
	PublishItem: 2,
	/** 删除 */
	DeleteItem: 3,
}
