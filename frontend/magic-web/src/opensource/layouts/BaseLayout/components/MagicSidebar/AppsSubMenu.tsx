import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useRequest } from "ahooks"
import { MagicDropdown } from "@/opensource/components/base"
import { sidebarStore } from "@/opensource/stores/layout"
import { GlobalApi } from "@/opensource/apis"
import { AppMenuOpenMethod, AppMenuIconType, AppMenuStatus } from "@/opensource/apis/types"
import type { AppMenuItem } from "@/opensource/apis/types"
import { baseHistory } from "@/opensource/routes/history/baseHistory"
import { normalizeLocale } from "@/opensource/utils/locale"
import { SupportLocales } from "@/opensource/constants/locale"
import IconComponent from "@/opensource/pages/superMagic/components/IconViewComponent"
import { routesMatch } from "@/opensource/routes/history/helpers"
import { configStore } from "@/opensource/models/config"
import { defaultClusterCode } from "@/opensource/routes/helpers"

type AppsSubMenuProps = {
	children: ReactNode
	visible?: boolean
}

/**
 * 对以 / 开头的内部路径，精确检查是否存在 "/:clusterCode${path}" 路由定义。
 * 若精确匹配，则在路径前补充当前 clusterCode；否则按原始路径处理。
 */
function resolveMenuPath(path: string): string {
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

/** 按当前语言取 name_i18n，依次降级：当前语言 → zh_CN → en_US → 任意有值的语言 */
function resolveMenuName(name_i18n: Record<string, string>, language: string): string {
	const locale = normalizeLocale(language)
	return (
		name_i18n[locale] ?? name_i18n[SupportLocales.zhCN] ?? name_i18n[SupportLocales.enUS] ?? ""
	)
}

function AppMenuIcon({ item, displayName }: { item: AppMenuItem; displayName: string }) {
	if (item.icon_type === AppMenuIconType.Image) {
		return (
			<img
				src={item.icon_url}
				alt={displayName}
				className="h-4 w-4 shrink-0 rounded-sm object-cover"
				draggable={false}
			/>
		)
	}

	return <IconComponent selectedIcon={item.icon} size={16} />
}

function AppsSubMenu({ children, visible = true }: AppsSubMenuProps) {
	const [open, setOpen] = useState(false)
	const { i18n } = useTranslation()

	const { data: menuItems = [], loading } = useRequest(() => GlobalApi.getAppMenuModules(), {
		refreshDeps: [],
	})

	const activeMenuItems = menuItems.filter((item) => item.status === AppMenuStatus.Normal)

	const handleMenuItemClick = (item: AppMenuItem) => {
		if (item.open_method === AppMenuOpenMethod.NewWindow) {
			const resolvedPath = resolveMenuPath(item.path)
			const url = resolvedPath.startsWith("/")
				? `${window.location.origin}${resolvedPath}`
				: resolvedPath
			window.open(url, "_blank", "noopener,noreferrer")
		} else {
			baseHistory.push(resolveMenuPath(item.path))
		}
		setOpen(false)
		sidebarStore.collapseIfNarrow()
	}

	useEffect(() => {
		if (!visible) setOpen(false)
	}, [visible])

	const renderPopup = () => (
		<div
			className="flex w-[240px] flex-col gap-1 rounded-md border border-border bg-popover p-1"
			style={{ boxShadow: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)" }}
			data-testid="sidebar-apps-submenu-popup"
		>
			{loading && (
				<div
					className="flex flex-col gap-1 p-1"
					data-testid="sidebar-apps-submenu-skeleton"
				>
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-8 w-full animate-pulse rounded-md bg-sidebar-accent"
						/>
					))}
				</div>
			)}
			{!loading && activeMenuItems.length === 0 && (
				<div className="flex h-8 items-center px-2">
					<span
						className="text-sm text-muted-foreground"
						data-testid="sidebar-apps-submenu-empty"
					>
						—
					</span>
				</div>
			)}
			{!loading &&
				activeMenuItems.map((item) => {
					const displayName = resolveMenuName(item.name_i18n, i18n.language)
					return (
						<div
							key={item.id}
							role="button"
							tabIndex={0}
							className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-sidebar-accent"
							onClick={() => handleMenuItemClick(item)}
							data-testid={`sidebar-apps-submenu-item-${item.id}`}
						>
							<AppMenuIcon item={item} displayName={displayName} />
							<div className="flex-1 truncate text-left text-sm leading-5 text-sidebar-foreground">
								{displayName}
							</div>
						</div>
					)
				})}
		</div>
	)

	return (
		<MagicDropdown
			placement="rightTop"
			popupRender={renderPopup}
			open={open}
			onOpenChange={setOpen}
			overlayClassName="p-0"
			trigger={["click"]}
		>
			<span className="inline-flex w-full" data-testid="sidebar-apps-submenu-trigger">
				{children}
			</span>
		</MagicDropdown>
	)
}

export default AppsSubMenu
