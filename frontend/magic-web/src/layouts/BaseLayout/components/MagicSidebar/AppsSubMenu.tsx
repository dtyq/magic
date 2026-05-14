import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useRequest } from "ahooks"
import { MagicDropdown } from "@/components/base"
import { sidebarStore } from "@/stores/layout"
import { GlobalApi } from "@/apis"
import { AppMenuIconType } from "@/apis/types"
import type { AppMenuItem } from "@/apis/types"
import IconComponent from "@/pages/superMagic/components/IconViewComponent"
import { getVisibleAppMenuItems, openAppMenuItem, resolveAppMenuName } from "@/utils/appMenu"

type AppsSubMenuProps = {
	children: ReactNode
	visible?: boolean
}

/** 侧栏子菜单图标沿用现有 Icon / 图片双形态渲染，保证桌面与移动端目录来源一致。 */
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

/** 桌面侧栏 Apps 子菜单继续复用统一 app-menu helper，避免与独立 Apps 页面行为分叉。 */
function AppsSubMenu({ children, visible = true }: AppsSubMenuProps) {
	const [open, setOpen] = useState(false)
	const { i18n } = useTranslation()

	const { data: menuItems = [], loading } = useRequest(() => GlobalApi.getAppMenuModules(), {
		refreshDeps: [],
	})

	const activeMenuItems = getVisibleAppMenuItems(menuItems)

	/** 侧栏子菜单与 Apps 页面共享同一跳转语义，避免窗口打开方式出现分叉。 */
	const handleMenuItemClick = (item: AppMenuItem) => {
		openAppMenuItem(item)
		setOpen(false)
		sidebarStore.collapseIfNarrow()
	}

	useEffect(() => {
		if (!visible) setOpen(false)
	}, [visible])

	useEffect(() => {
		if (!loading && activeMenuItems.length === 0) setOpen(false)
	}, [activeMenuItems.length, loading])

	if (!loading && activeMenuItems.length === 0) return null

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
			{!loading &&
				activeMenuItems.map((item) => {
					const displayName = resolveAppMenuName(item.name_i18n, i18n.language)
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
