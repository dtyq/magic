import { Flex, Menu } from "antd"
import { forwardRef, useMemo } from "react"
import { IconDots } from "@tabler/icons-react"
import { useLocation } from "react-router"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { useMemoizedFn } from "ahooks"
import { useGlobalLanguage } from "@/opensource/models/config/hooks"
import Divider from "@/opensource/components/other/Divider"
import type { MenuItemType } from "antd/es/menu/interface"
import { useAutoCollapsed } from "./hooks"
import { useStyles } from "./styles"
import UserMenus from "../UserMenus"
import SiderActionSlot from "./components/SiderActionSlot"
import OrganizationSwitch from "./components/OrganizationSwitch"
import { RoutePath } from "@/opensource/constants/routes"
import { observer } from "mobx-react-lite"
import { userStore } from "@/opensource/models/user"
import UserAvatarRender from "@/opensource/components/business/UserAvatarRender"
import { history } from "@/opensource/routes/history"

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

			const { styles, cx } = useStyles({ collapsed: useAutoCollapsed(collapsed), language })

			const handleNavigate = useMemoizedFn(({ key }: { key: string }) => {
				// navigate(key)
				history.push({ name: key })
			})

			const OrganizationSwitchChildren = useMemo(
				() => (
					<div className={styles.icon}>
						<MagicIcon color="currentColor" size={16} component={IconDots} />
					</div>
				),
				[styles.icon],
			)

			return (
				<Flex
					ref={ref}
					className={cx(styles.sider, className)}
					vertical
					align="center"
					justify="space-between"
				>
					<UserMenus>
						<UserAvatarRender userInfo={userInfo} size={40} />
					</UserMenus>
					<Divider direction="horizontal" className={styles.divider} />
					<Flex vertical flex={1} className={styles.menus}>
						{menuItems?.map((menu, index) => {
							const key = `index-${index}`
							return (
								<Menu
									key={key}
									mode="inline"
									selectedKeys={selectedKeys}
									className={cx(styles.menu)}
									items={menu}
									onClick={handleNavigate}
								/>
							)
						})}
					</Flex>
					<SiderActionSlot />
					<Divider direction="horizontal" className={styles.divider} />
					<Flex gap={4} align="center" className={styles.organizationSwitchWrapper}>
						<OrganizationSwitch showPopover={false} />
						<OrganizationSwitch showPopover>
							{OrganizationSwitchChildren}
						</OrganizationSwitch>
					</Flex>
				</Flex>
			)
		},
	),
)

export default Sider
