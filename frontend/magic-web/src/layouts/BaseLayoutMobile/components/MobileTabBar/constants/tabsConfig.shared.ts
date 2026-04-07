import { createElement, type ReactNode } from "react"
import { MobileTabBarKey, ROUTE_NAME_TO_TAB_PARAM } from "@/pages/mobileTabs/constants"
import {
	AppsIcon,
	ApprovalIcon,
	MagiClawIcon,
	MessageIcon,
	RecordingIcon,
} from "@/layouts/BaseLayoutMobile/components/MobileTabBar/icons"
import type { TabIconProps } from "@/layouts/BaseLayoutMobile/components/MobileTabBar/icons"
import { ProfileIcon } from "@/layouts/BaseLayoutMobile/components/MobileTabBar/icons/ProfileIcon"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

export const MOBILE_TAB_BAR_APPS_KEY = "apps"

export type MobileTabBarBadgeName = "chatUnreadCount"
export type MobileTabBarIconComponent = (props: TabIconProps) => ReactNode
export type MobileTabBarMenuKey = MobileTabBarKey | typeof MOBILE_TAB_BAR_APPS_KEY

export interface MobileTabBarConfig {
	key: MobileTabBarMenuKey
	iconComponent: MobileTabBarIconComponent
	titleKey: string
	badgeName?: MobileTabBarBadgeName
	children?: MobileTabBarConfig[]
}

export interface MobileTabBarItem {
	key: MobileTabBarMenuKey
	icon: ReactNode
	iconComponent: MobileTabBarIconComponent
	title: string
	badge?: number
	className?: string
	children?: MobileTabBarItem[]
	testIdSuffix: string
}

export interface SharedMobileTabBarConfigsParams {
	isPersonalOrganization: boolean
	superIconComponent: MobileTabBarIconComponent
	includeRecording: boolean
	appsChildrenConfigs: MobileTabBarConfig[]
}

export interface SharedMobileTabBarItemsParams extends SharedMobileTabBarConfigsParams {
	activeKey: MobileTabBarKey
	chatUnreadCount: number
	iconSize: number
	translate: (key: string, values?: Record<string, string>) => string
}

function getSuperTabConfig(superIconComponent: MobileTabBarIconComponent): MobileTabBarConfig {
	return {
		key: MobileTabBarKey.Super,
		iconComponent: superIconComponent,
		titleKey: "sider.mobileTabBar.super",
	}
}

function getMagiClawTabConfig(): MobileTabBarConfig {
	return {
		key: MobileTabBarKey.MagiClaw,
		iconComponent: MagiClawIcon,
		titleKey: "sider.mobileTabBar.magiClaw",
	}
}

function getRecordingTabConfig(): MobileTabBarConfig {
	return {
		key: MobileTabBarKey.Recording,
		iconComponent: RecordingIcon,
		titleKey: "sider.mobileTabBar.recording",
	}
}

function getProfileTabConfig(): MobileTabBarConfig {
	return {
		key: MobileTabBarKey.Profile,
		iconComponent: ProfileIcon,
		titleKey: "sider.mobileTabBar.profile",
	}
}

function getChatTabConfig(): MobileTabBarConfig {
	return {
		key: MobileTabBarKey.Chat,
		iconComponent: MessageIcon,
		titleKey: "sider.mobileTabBar.chat",
		badgeName: "chatUnreadCount",
	}
}

function getApprovalTabConfig(): MobileTabBarConfig {
	return {
		key: MobileTabBarKey.Approval,
		iconComponent: ApprovalIcon,
		titleKey: "sider.mobileTabBar.approval",
	}
}

function getAppsTabConfig(children: MobileTabBarConfig[]): MobileTabBarConfig {
	return {
		key: MOBILE_TAB_BAR_APPS_KEY,
		iconComponent: AppsIcon,
		titleKey: "sider.mobileTabBar.apps",
		children,
	}
}

export function getOrganizationAppsChildrenConfigs(params: {
	isPersonalOrganization: boolean
}): MobileTabBarConfig[] {
	if (params.isPersonalOrganization) return []
	return [getChatTabConfig(), getApprovalTabConfig()]
}

function getTabBadgeCount(params: {
	badgeName?: MobileTabBarBadgeName
	chatUnreadCount: number
}): number | undefined {
	const { badgeName, chatUnreadCount } = params

	if (!badgeName) return undefined
	if (badgeName === "chatUnreadCount") return chatUnreadCount
}

function getTabTestIdSuffix(key: MobileTabBarMenuKey): string {
	if (key === MOBILE_TAB_BAR_APPS_KEY) return MOBILE_TAB_BAR_APPS_KEY
	return ROUTE_NAME_TO_TAB_PARAM[key]
}

function createMobileTabBarItem(params: {
	activeKey: MobileTabBarKey
	chatUnreadCount: number
	config: MobileTabBarConfig
	iconSize: number
	translate: (key: string, values?: Record<string, string>) => string
}): MobileTabBarItem {
	const { activeKey, chatUnreadCount, config, iconSize, translate } = params
	const title =
		config.titleKey === "sider.mobileTabBar.magiClaw"
			? translate(config.titleKey, getClawBrandTranslationValues())
			: translate(config.titleKey)

	return {
		key: config.key,
		icon: createElement(config.iconComponent, {
			active: activeKey === config.key,
			size: iconSize,
		}),
		iconComponent: config.iconComponent,
		title,
		badge: getTabBadgeCount({
			badgeName: config.badgeName,
			chatUnreadCount,
		}),
		children: config.children?.map((item) =>
			createMobileTabBarItem({
				activeKey,
				chatUnreadCount,
				config: item,
				iconSize,
				translate,
			}),
		),
		testIdSuffix: getTabTestIdSuffix(config.key),
	}
}

export function buildMobileTabBarConfigs(
	params: SharedMobileTabBarConfigsParams,
): MobileTabBarConfig[] {
	const { appsChildrenConfigs, includeRecording, isPersonalOrganization, superIconComponent } =
		params
	const sharedConfigs = [getSuperTabConfig(superIconComponent), getMagiClawTabConfig()]
	const recordingConfigs = includeRecording ? [getRecordingTabConfig()] : []
	const appsConfigs =
		appsChildrenConfigs.length > 0 ? [getAppsTabConfig(appsChildrenConfigs)] : []

	if (isPersonalOrganization) {
		return [...sharedConfigs, ...recordingConfigs, ...appsConfigs, getProfileTabConfig()]
	}

	return [...sharedConfigs, ...recordingConfigs, ...appsConfigs, getProfileTabConfig()]
}

export function buildMobileTabBarItems(params: SharedMobileTabBarItemsParams): MobileTabBarItem[] {
	const {
		activeKey,
		appsChildrenConfigs,
		chatUnreadCount,
		iconSize,
		includeRecording,
		isPersonalOrganization,
		superIconComponent,
		translate,
	} = params

	return buildMobileTabBarConfigs({
		appsChildrenConfigs,
		includeRecording,
		isPersonalOrganization,
		superIconComponent,
	}).map((item) =>
		createMobileTabBarItem({
			activeKey,
			chatUnreadCount,
			config: item,
			iconSize,
			translate,
		}),
	)
}
