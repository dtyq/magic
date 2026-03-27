import { RouteName } from "@/routes/constants"

/**
 * Mobile Tab URL query parameter values
 * URL 查询参数中使用的 tab 值
 */
export const MobileTabParam = {
	Chat: "chat",
	Approval: "approval",
	MagiClaw: "magi-claw",
	Recording: "recording",
	Contacts: "contacts",
	Super: "super",
	Profile: "profile",
} as const

export type MobileTabParamValue = (typeof MobileTabParam)[keyof typeof MobileTabParam]

/**
 * Mobile Tab types that can be displayed in tab bar
 * 可以在 Tab Bar 中显示的 Mobile Tab 类型
 */
export enum MobileTabBarKey {
	Chat = RouteName.Chat,
	Super = RouteName.Super,
	Approval = RouteName.MagicApproval,
	MagiClaw = RouteName.MagiClaw,
	Contacts = RouteName.Contacts,
	Profile = RouteName.Profile,
	Recording = RouteName.MobileTabsRecording,
}

/**
 * Mapping from MobileTabBarKey to native app tab bar key
 * MobileTabBarKey 到 原生App 的 Tab Bar 键值的映射
 */
export const APP_TAB_BAR_KEYS_MAP: Partial<
	Record<
		MobileTabBarKey,
		"chat" | "super" | "approval" | "contacts" | "profile" | "ai_recording" | "magic_claw"
	>
> = {
	[MobileTabBarKey.Chat]: "chat",
	[MobileTabBarKey.Super]: "super",
	[MobileTabBarKey.MagiClaw]: "magic_claw",
	[MobileTabBarKey.Approval]: "approval",
	[MobileTabBarKey.Contacts]: "contacts",
	[MobileTabBarKey.Profile]: "profile",
	[MobileTabBarKey.Recording]: "ai_recording",
}

/**
 * Mapping from URL tab parameter to RouteName
 * URL tab 参数到 RouteName 的映射
 */
export const TAB_PARAM_TO_TAB_KEY: Record<MobileTabParamValue, MobileTabBarKey> = {
	[MobileTabParam.Chat]: MobileTabBarKey.Chat,
	[MobileTabParam.Approval]: MobileTabBarKey.Approval,
	[MobileTabParam.MagiClaw]: MobileTabBarKey.MagiClaw,
	[MobileTabParam.Contacts]: MobileTabBarKey.Contacts,
	[MobileTabParam.Super]: MobileTabBarKey.Super,
	[MobileTabParam.Profile]: MobileTabBarKey.Profile,
	[MobileTabParam.Recording]: MobileTabBarKey.Recording,
}

/**
 * Mapping from RouteName to URL tab parameter
 * RouteName 到 URL tab 参数的映射
 */
export const ROUTE_NAME_TO_TAB_PARAM: Record<MobileTabBarKey, MobileTabParamValue> = {
	[RouteName.Chat]: MobileTabParam.Chat,
	[RouteName.MagicApproval]: MobileTabParam.Approval,
	[RouteName.MagiClaw]: MobileTabParam.MagiClaw,
	[RouteName.Contacts]: MobileTabParam.Contacts,
	[RouteName.Super]: MobileTabParam.Super,
	[RouteName.Profile]: MobileTabParam.Profile,
	[RouteName.MobileTabsRecording]: MobileTabParam.Recording,
}
