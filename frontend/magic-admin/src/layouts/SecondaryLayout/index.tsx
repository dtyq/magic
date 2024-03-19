import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Breadcrumb, Flex } from "antd"
import { useMemo, memo, Suspense } from "react"
import { useTranslation } from "react-i18next"
import type { SideMenuItem, SideMenuProps } from "components"
import { MagicSpin, SideMenu } from "components"
import { IconChevronRight } from "@tabler/icons-react"
import type { ItemType } from "antd/es/breadcrumb/Breadcrumb"
import { routes } from "@/routes"
import { useAdminStore } from "@/stores/admin"
import { useAdminAuth } from "@/hooks/useAdminAuth"
import { findRouteByPathname, checkItemPermission } from "@/utils/routeUtils"
import NotAuthPage from "@/pages/NotAuthPage"
import { useIsMobile } from "@/hooks/useIsMobile"
import { RoutePath } from "@/const/routes"
import { useStyles } from "./styles"
import SecondaryLayoutMobile from "../SecondaryLayoutMobile"

export interface SecondaryLayoutProps extends Pick<SideMenuProps, "openKeys"> {
	usePadding?: boolean
	items: SideMenuItem[]
}

const SecondaryLayoutPc = (props: SecondaryLayoutProps) => {
	const { items, openKeys, usePadding = true } = props

	const { t } = useTranslation("admin/common")
	const { styles, cx } = useStyles()

	const { extraBreadcrumb, setSiderCollapsed } = useAdminStore()

	const { hasPermission } = useAdminAuth()

	const { pathname } = useLocation()
	const navigate = useNavigate()

	// 根据当前路径生成面包屑项目
	const bdItem = useMemo(() => {
		const breadcrumbItems: ItemType[] = []
		const pathSegments = pathname.split("/").filter(Boolean)

		if (routes?.[0]?.children) {
			findRouteByPathname(pathSegments, routes, {
				onRouteMatch: (route) => {
					if (route.title) {
						const isLast = breadcrumbItems.length === pathSegments.length - 1
						breadcrumbItems.push({
							title: isLast ? (
								t(route.title)
							) : (
								<div
									className={styles.clickable}
									onClick={() => {
										navigate(route?.path || route.name || "")
									}}
								>
									{t(route.title)}
								</div>
							),
							key: route.name || route.path,
						})
					}
				},
			})
		}

		// 添加额外的面包屑（如果有）
		if (extraBreadcrumb && extraBreadcrumb.length > 0) {
			extraBreadcrumb.forEach((item) => {
				breadcrumbItems.push({
					title: item.path ? <Link to={item.path}>{item.title}</Link> : item.title,
					key: item.key,
				})
			})
		}

		return breadcrumbItems
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [extraBreadcrumb, navigate, pathname, t])

	return (
		<div className={styles.layout}>
			{items.length > 0 && (
				<SideMenu
					items={items}
					defaultOpenKeys={openKeys}
					pathname={pathname}
					navigate={navigate}
					onCollapse={setSiderCollapsed}
				/>
			)}
			{hasPermission ? (
				<Flex vertical className={styles.wrapper}>
					<Breadcrumb
						className={styles.breadcrumb}
						separator={<IconChevronRight stroke={1.5} size={20} />}
						items={bdItem}
					/>
					<div className={cx(styles.content, usePadding && styles.contentPadding)}>
						<Suspense
							fallback={
								<Flex
									justify="center"
									align="center"
									style={{ height: "calc(100vh - 70px)" }}
								>
									<MagicSpin />
								</Flex>
							}
						>
							<Outlet />
						</Suspense>
					</div>
				</Flex>
			) : (
				<NotAuthPage className={styles.notAuthPage} />
			)}
		</div>
	)
}

const SecondaryLayout = memo((props: SecondaryLayoutProps) => {
	const { items, ...rest } = props
	const isMobile = useIsMobile()

	const { userPermissions, teamshareUserPermissions } = useAdminStore()

	// 递归过滤菜单项
	const menuItems = useMemo(() => {
		const filterMenuItems = (menuItemsList: SideMenuItem[]): SideMenuItem[] => {
			return menuItemsList
				.filter((item) => {
					const isTeamshare =
						((item.key as string)?.startsWith(RoutePath.OAApproval) ||
							(item.key as string)?.startsWith(RoutePath.EnterpriseOrganization)) ??
						false
					return checkItemPermission(
						item,
						isTeamshare,
						teamshareUserPermissions,
						userPermissions,
					)
				})
				.map((item) => {
					// 处理子项
					const filteredChildren = item.children?.length
						? filterMenuItems(item.children)
						: item.children

					return {
						...item,
						children: filteredChildren,
					}
				})
		}
		return filterMenuItems(items)
	}, [items, teamshareUserPermissions, userPermissions])

	return isMobile ? (
		<SecondaryLayoutMobile items={menuItems} {...rest} />
	) : (
		<SecondaryLayoutPc items={menuItems} {...rest} />
	)
})

export default SecondaryLayout
