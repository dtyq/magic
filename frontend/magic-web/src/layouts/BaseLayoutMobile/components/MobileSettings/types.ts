import type { ReactNode } from "react"
import type { RouteName } from "@/routes/constants"

export interface PointsRecordItem {
	id: string
	amount: number
	label: string
	description: string
	/** 备注说明；历史数据可能缺失，空值时不展示备注区域。 */
	remark: string
	createdAt: string
	updatedAt: string
}

export interface PointsRecordGroup {
	label: string
	items: PointsRecordItem[]
}

export interface InfoPopoverState {
	top: number
	right: number
}

export type MobileSettingsSectionKey = "points" | "account" | "application" | "logout"

export type MobileSettingsRootItemKey =
	| "pointsPurchase"
	| "teamPoints"
	| "personalQuota"
	| "pointsDetail"
	| "orderHistory"
	| "profile"
	| "accountSecurity"
	| "loginDevices"
	| "appSettings"
	| "feedback"
	| "logout"

export type MobileSettingsPanelKey =
	| "pointsPurchase"
	| "teamPoints"
	| "personalQuota"
	| "pointsDetail"
	| "orderHistory"
	| "profile"
	| "feedback"
	| "accountSecurity"
	| "phoneSecurity"
	| "loginDevices"
	| "passwordEditor"
	| "appSettings"
	| "appSettingsLanguage"
	| "appSettingsTimezone"

export interface MobileSettingsConfigSection {
	key: MobileSettingsSectionKey
	items: MobileSettingsRootItemKey[]
}

export interface MobileSettingsConfig {
	sections: MobileSettingsConfigSection[]
}

export type MobileSettingsPointsRole = "personal" | "teamAdmin" | "teamMember"

export interface MobileSettingsPersonalQuota {
	used: number
	total: number
	percent: number
}

export interface MobileSettingsPointsOverview {
	role: MobileSettingsPointsRole
	primaryPoints: number | null
	personalQuota: MobileSettingsPersonalQuota | null
	hasLoadedData: boolean
}

export interface MobileSettingsMenuItemConfig {
	icon: ReactNode
	label: string
	value?: ReactNode
	onClick: () => void
	disabled?: boolean
	danger?: boolean
	chevron?: boolean
	dataTestId: string
}

export interface MobileSettingsMenuSectionConfig {
	key: MobileSettingsSectionKey
	items: MobileSettingsMenuItemConfig[]
}

export type MobileSettingsRootItemAction =
	| { type: "panel"; panel: MobileSettingsPanelKey }
	| { type: "route"; routeName: RouteName }
	| { type: "effect"; effect: "logout" }
