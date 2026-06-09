export interface GlobalConfig {
	is_maintenance: boolean
	maintenance_description: string
}

export interface NameI18N {
	en_US?: string
	zh_CN?: string
	default?: string
}

/** 套餐类型 */
export enum PackageType {
	/** 个人套餐 */
	Personal = "personal",
	/** 团队套餐 */
	Team = "team",
	/** 企业套餐 */
	Enterprise = "enterprise",
}

/** 订阅类型 */
export enum SubscriptionType {
	/** 月度订阅 */
	Monthly = "monthly",
	/** 年度订阅 */
	Yearly = "yearly",
	/** 永久订阅 */
	Permanent = "permanent",
}
