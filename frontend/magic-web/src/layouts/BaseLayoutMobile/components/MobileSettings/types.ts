import type { ReactNode } from "react"
import type { RouteName } from "@/routes/constants"

export interface PointsRecordItem {
	id: string
	amount: number
	label: string
	description: string
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
