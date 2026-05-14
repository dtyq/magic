import { AppMenuOpenMethod, AppMenuStatus } from "@/apis/types"
import type { AppMenuItem } from "@/apis/types"
import { SupportLocales } from "@/constants/locale"
import { configStore } from "@/models/config"
import { baseHistory } from "@/routes/history/baseHistory"
import { routesMatch } from "@/routes/history/helpers"
import { defaultClusterCode } from "@/routes/helpers"
import { normalizeLocale } from "@/utils/locale"

/**
 * 对以 `/` 开头的内部路径补齐当前组织前缀，但只在主路由里存在 `/:clusterCode` 映射时生效。
 */
export function resolveAppMenuPath(path: string): string {
	if (!path.startsWith("/")) return path

	const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
	const pathWithCluster = `/${clusterCode}${path}`
	const match = routesMatch(pathWithCluster)
	const routePath = match?.route.path ?? ""

	if (routePath === `/:clusterCode${path}`) {
		return pathWithCluster
	}

	return path
}

/**
 * 按当前语言优先级解析应用名称，保证移动端与桌面端看到的是同一份本地化名称。
 */
export function resolveAppMenuName(nameI18n: Record<string, string>, language: string): string {
	const locale = normalizeLocale(language)

	return nameI18n[locale] ?? nameI18n[SupportLocales.zhCN] ?? nameI18n[SupportLocales.enUS] ?? ""
}

/**
 * 过滤掉禁用项，并按后端约定的 `sort_order` 倒序排列应用目录。
 */
export function getVisibleAppMenuItems(menuItems: AppMenuItem[]): AppMenuItem[] {
	return [...menuItems]
		.filter((item) => item.status === AppMenuStatus.Normal)
		.sort((left, right) => right.sort_order - left.sort_order)
}

/**
 * 统一处理应用目录点击，复用桌面端现有的当前窗口 / 新窗口语义。
 */
export function openAppMenuItem(item: AppMenuItem): void {
	const resolvedPath = resolveAppMenuPath(item.path)

	if (item.open_method === AppMenuOpenMethod.NewWindow) {
		const nextUrl = resolvedPath.startsWith("/")
			? `${window.location.origin}${resolvedPath}`
			: resolvedPath
		window.open(nextUrl, "_blank", "noopener,noreferrer")
		return
	}

	baseHistory.push(resolvedPath)
}
