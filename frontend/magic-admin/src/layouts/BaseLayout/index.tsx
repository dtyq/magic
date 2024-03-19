import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useMemo, useEffect } from "react"
import { IconStack2 } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Flex } from "antd"
import { TopMenu } from "components"
import AtLogo from "@/assets/logos/favicon.svg"
import { RoutePath } from "@/const/routes"
import { useAdminStore } from "@/stores/admin"
import { PLATFORM_MANAGEMENT } from "@/const/common"
import { findRouteByPathname } from "@/utils/routeUtils"
import { routes } from "@/routes"
import { useStyles } from "./styles"
import { withAuthMiddleware } from "./components/AuthMiddleware"

function BaseLayout() {
	const { t } = useTranslation("common")

	const location = useLocation()
	const { pathname } = location
	const navigate = useNavigate()
	const { styles, cx } = useStyles()

	const { isOfficialOrg, userPermissions, permissionsKeys, setCurrentRouteItems } =
		useAdminStore()

	const items = useMemo(
		() => [
			{
				key: RoutePath.Platform,
				label: t("nav.platform"),
				icon: <IconStack2 size={20} />,
				hidden:
					!isOfficialOrg ||
					!userPermissions.some((permission: string) =>
						PLATFORM_MANAGEMENT.includes(permission),
					),
			},
		],

		// eslint-disable-next-line react-hooks/exhaustive-deps
		[t, isOfficialOrg, permissionsKeys],
	)

	/* 根据路由项的 hidden 属性，判断是否隐藏顶部菜单 */
	const currentRouteItems = useMemo(() => {
		// 根据 pathname 查找对应的路由项
		const pathSegments = pathname.split("/").filter(Boolean)
		return findRouteByPathname(pathSegments, routes)
	}, [pathname])

	// 使用 useEffect 处理副作用
	useEffect(() => {
		setCurrentRouteItems(currentRouteItems)
	}, [currentRouteItems, setCurrentRouteItems])

	const hiddenMenu = useMemo(() => {
		return currentRouteItems && currentRouteItems?.hiddenMenu
	}, [currentRouteItems])

	return (
		<div className={styles.layout}>
			{!hiddenMenu && (
				<div className={styles.header}>
					<Flex gap={8} align="center" className={styles.logo}>
						<img src={AtLogo} alt="atLogo" width={40} />
						<div className={styles.title}>{t("title")}</div>
					</Flex>
					<TopMenu items={items} pathname={location.pathname} navigate={navigate} />
				</div>
			)}
			<div className={cx(!hiddenMenu ? styles.wrapper : styles.wrapperWithoutMenu)}>
				<Outlet />
			</div>
		</div>
	)
}

export default withAuthMiddleware(BaseLayout)
