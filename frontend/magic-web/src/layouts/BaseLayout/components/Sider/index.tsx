import { Menu, theme } from "antd"
import { forwardRef, useMemo, type CSSProperties } from "react"
import { IconDots } from "@tabler/icons-react"
import { useLocation } from "react-router"
import MagicIcon from "@/components/base/MagicIcon"
import { useMemoizedFn } from "ahooks"
import { useGlobalLanguage } from "@/models/config/hooks"
import Divider from "@/components/other/Divider"
import type { MenuItemType } from "antd/es/menu/interface"
import { useAutoCollapsed } from "./hooks"
import { getMenuClassName, siderClassNames } from "./classNames"
import { cn } from "@/utils/cn"
import UserMenus from "../UserMenus"
import SiderActionSlot from "./components/SiderActionSlot"
import OrganizationSwitch from "./components/OrganizationSwitch"
import { RoutePath } from "@/constants/routes"
import { observer } from "mobx-react-lite"
import { userStore } from "@/models/user"
import UserAvatarRender from "@/components/business/UserAvatarRender"
import { history } from "@/routes/history"

interface SiderProps {
	collapsed?: boolean
	className?: string
	menuItems?: Array<Array<MenuItemType>>
}

const Sider = observer(
	forwardRef<HTMLDivElement, SiderProps>(
		({ collapsed = false, className, menuItems }: SiderProps, ref) => {
			const { pathname } = useLocation()

			// 选中状态计算
			const selectedKeys = useMemo(() => {
				// 针对云盘相关的路由，返回导航栏中云盘选项的key
				if (pathname.startsWith(RoutePath.Drive)) {
					return [RoutePath.DriveRecent]
				}
				// 获取路径的第一段，例如：/aaa/bbb -> /aaa
				const getFirstPathSegment = (path: string) => {
					// 移除查询参数
					const pathWithoutQuery = path.split("?")[0]
					// 分割路径并获取第一段
					const segments = pathWithoutQuery.split("/").filter(Boolean)
					return segments.length > 0 ? `/${segments[0]}` : "/"
				}
				// 其他情况返回当前路径的第一段
				return [getFirstPathSegment(pathname)]
			}, [pathname])

			const language = useGlobalLanguage(false)

			const { userInfo } = userStore.user

			const isCollapsed = useAutoCollapsed(collapsed)
			const { token } = theme.useToken()

			const handleNavigate = useMemoizedFn(({ key }: { key: string }) => {
				// navigate(key)
				history.push({ name: key })
			})

			const OrganizationSwitchChildren = useMemo(
				() => (
					<div className={siderClassNames.icon}>
						<MagicIcon color="currentColor" size={16} component={IconDots} />
					</div>
				),
				[],
			)

			return (
				<div
					ref={ref}
					className={cn(siderClassNames.root, isCollapsed ? "w-14" : "w-auto", className)}
					// Keep the title-bar height configurable by the active theme provider.
					style={{ "--title-bar-height": `${token.titleBarHeight}px` } as CSSProperties}
				>
					<UserMenus>
						<UserAvatarRender userInfo={userInfo} size={40} />
					</UserMenus>
					<Divider direction="horizontal" className={siderClassNames.divider} />
					<div className={siderClassNames.menus}>
						{menuItems?.map((menu, index) => {
							const key = `index-${index}`
							return (
								<Menu
									key={key}
									mode="inline"
									selectedKeys={selectedKeys}
									className={getMenuClassName(language)}
									items={menu}
									onClick={handleNavigate}
								/>
							)
						})}
					</div>
					<SiderActionSlot />
					<Divider direction="horizontal" className={siderClassNames.divider} />
					<div
						className={cn(
							"flex items-center gap-1",
							isCollapsed ? "flex-col" : "flex-row",
						)}
					>
						<OrganizationSwitch showPopover={false} />
						<OrganizationSwitch showPopover>
							{OrganizationSwitchChildren}
						</OrganizationSwitch>
					</div>
				</div>
			)
		},
	),
)

export default Sider
