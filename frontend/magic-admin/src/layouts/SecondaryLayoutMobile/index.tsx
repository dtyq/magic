import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Flex } from "antd"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconChevronLeft, IconMenu2 } from "@tabler/icons-react"
import type { SideMenuItem } from "components"
import { MagicButton } from "components"
import { Popup } from "antd-mobile"
import NotAuthPage from "@/pages/NotAuthPage"
import { routes } from "@/routes"
import { useAdmin } from "@/provider/AdminProvider"
import { useStyles } from "./styles"
import { useAdminAuth } from "../../hooks/useAdminAuth"
import { findRouteByPathname } from "../../utils/routeUtils"
import type { SecondaryLayoutProps } from "../SecondaryLayout"

const SecondaryLayoutMobile = (props: SecondaryLayoutProps) => {
	const { items } = props

	const { t } = useTranslation("admin/common")

	const { safeAreaInset } = useAdmin()
	const { styles, cx } = useStyles({
		safeAreaInsetTop: safeAreaInset?.top || 0,
	})

	const navigate = useNavigate()
	const { pathname } = useLocation()
	const { hasPermission } = useAdminAuth()

	const [menuVisible, setMenuVisible] = useState(false)

	// 获取二级布局标题
	const currentTitle = useMemo(() => {
		const secondRoutes = routes?.[0]?.children
		if (secondRoutes) {
			const routeItem = secondRoutes.find(
				(route) => route.path && pathname.includes(route.path),
			)
			if (routeItem && "title" in routeItem) {
				return t(routeItem?.title as string)
			}
		}
		return t("title")
	}, [pathname, t])

	// 获取当前页面标题
	const currentPageTitle = useMemo(() => {
		const pathSegments = pathname.split("/").filter(Boolean)
		let title = ""

		if (routes?.[0]?.children) {
			findRouteByPathname(pathSegments, routes, {
				onRouteMatch: (route) => {
					if (route.title) {
						title = t(route.title)
					}
				},
			})
		}

		return title
	}, [pathname, t])

	// 是否可以返回上一页
	const canGoBack = useMemo(() => {
		const pathSegments = pathname.split("/").filter(Boolean)
		return pathSegments.length > 2
	}, [pathname])

	const content = useMemo(() => {
		if (!hasPermission) {
			return <NotAuthPage />
		}
		return <Outlet />
	}, [hasPermission])

	const handleMenuItemClick = (item: SideMenuItem) => {
		if (item.key) {
			navigate(item.key as string)
			setMenuVisible(false)
		}
	}

	const renderMenuItem = (item: SideMenuItem) => {
		const isActive = pathname === item.key || pathname.startsWith(`${item.key}/`)

		return (
			<div key={item.key} className={styles.mobileMenuItem}>
				<div
					className={cx(styles.mobileMenuItemContent, {
						[styles.mobileMenuItemActive]: isActive,
					})}
					onClick={() => handleMenuItemClick(item)}
				>
					{item.icon && <span className={styles.mobileMenuItemIcon}>{item.icon}</span>}
					<span className={styles.mobileMenuItemLabel}>{item.label}</span>
				</div>
				{item.children && item.children.length > 0 && (
					<div className={styles.mobileMenuItemChildren}>
						{item.children.map((child) => renderMenuItem(child))}
					</div>
				)}
			</div>
		)
	}

	return (
		<div className={styles.mobileLayout}>
			{/* 移动端顶部导航栏 */}
			<div className={styles.mobileHeader}>
				<Flex align="center" gap={12}>
					{canGoBack && (
						<MagicButton
							type="text"
							icon={<IconChevronLeft size={24} />}
							onClick={() => navigate(-1)}
							className={styles.mobileHeaderButton}
						/>
					)}
					<div className={styles.mobileHeaderTitle}>{currentPageTitle}</div>
				</Flex>
				{items.length > 0 && (
					<MagicButton
						type="text"
						icon={<IconMenu2 size={24} />}
						onClick={() => setMenuVisible(true)}
						className={styles.mobileHeaderButton}
					/>
				)}
			</div>

			{/* 内容区域 */}
			<div className={styles.mobileContent}>{content}</div>

			{/* 侧边菜单抽屉 */}
			<Popup
				visible={menuVisible}
				onMaskClick={() => setMenuVisible(false)}
				position="left"
				bodyStyle={{ width: "80vw", maxWidth: "320px" }}
			>
				<div className={styles.mobileMenuDrawer}>
					<div className={styles.mobileMenuHeader}>
						<div className={styles.mobileMenuHeaderTitle}>{currentTitle}</div>
						<MagicButton
							type="text"
							onClick={() => setMenuVisible(false)}
							className={styles.mobileMenuCloseButton}
						>
							{t("button.close")}
						</MagicButton>
					</div>
					<div className={styles.mobileMenuList}>
						{items.map((item) => renderMenuItem(item))}
					</div>
				</div>
			</Popup>
		</div>
	)
}

export default SecondaryLayoutMobile
