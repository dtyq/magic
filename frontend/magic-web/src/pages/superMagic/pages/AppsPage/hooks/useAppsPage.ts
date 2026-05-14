import { createElement, useCallback, useMemo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { AppMenuItem } from "@/apis/types"
import { userStore } from "@/models/user"
import {
	getOrganizationAppsChildrenConfigs,
	type MobileTabBarConfig,
} from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared"
import {
	MobileTabBarKey,
	MobileTabParam,
	type MobileTabParamValue,
} from "@/pages/mobileTabs/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

export interface AppsPageEntry {
	id: string
	title: string
	targetTab: MobileTabParamValue
	renderIcon?: () => ReactNode
	iconType?: AppMenuItem["icon_type"]
	icon?: string
	iconUrl?: string
}

/**
 * 旧线上移动端 Apps 只有固定快捷项，因此新独立页也收敛到同一套目标入口。
 */
function resolveShortcutTargetTab(
	configKey: MobileTabBarConfig["key"],
): MobileTabParamValue | null {
	if (configKey === MobileTabBarKey.Chat) return MobileTabParam.Chat
	if (configKey === MobileTabBarKey.Approval) return MobileTabParam.Approval
	return null
}

/**
 * 将旧移动端 tab bar 的固定 apps 子项映射为独立页条目，避免页面语义继续漂移到动态应用目录。
 */
function buildFixedAppsEntries(params: {
	isPersonalOrganization: boolean
	translate: (key: string) => string
}): AppsPageEntry[] {
	const { isPersonalOrganization, translate } = params

	return getOrganizationAppsChildrenConfigs({
		isPersonalOrganization,
	}).flatMap((config) => {
		const targetTab = resolveShortcutTargetTab(config.key)
		if (!targetTab) return []

		return [
			{
				id: targetTab,
				title: translate(config.titleKey),
				targetTab,
				// 复用旧 tab 的高亮态图标，保持用户在“Apps 固定快捷入口”上的既有识别感。
				renderIcon: () =>
					createElement(config.iconComponent, {
						active: true,
						size: 24,
					}),
			},
		]
	})
}

/**
 * 收敛 Apps 页面所需的固定入口映射与点击跳转，避免 view 直接依赖旧 tab 配置细节。
 */
export function useAppsPage() {
	const { t } = useTranslation("interface")
	const navigate = useNavigate({
		fallbackRoute: { name: RouteName.MobileHome },
	})
	const isPersonalOrganization = userStore.user.isPersonalOrganization

	const entries = useMemo<AppsPageEntry[]>(
		() =>
			buildFixedAppsEntries({
				isPersonalOrganization,
				translate: t,
			}),
		[isPersonalOrganization, t],
	)

	/** 固定快捷项继续回到旧移动端 tab 跳转语义，而不是打开新的动态应用目录。 */
	const handleOpenEntry = useCallback(
		(entry: AppsPageEntry) => {
			navigate({
				name: RouteName.MobileTabs,
				query: { tab: entry.targetTab },
			})
		},
		[navigate],
	)

	/** 固定快捷项页当前无异步请求，但保留统一返回结构，减少 container/view 改动范围。 */
	const refresh = useCallback(() => undefined, [])

	return {
		entries,
		loading: false,
		error: null,
		refresh,
		handleOpenEntry,
	}
}
