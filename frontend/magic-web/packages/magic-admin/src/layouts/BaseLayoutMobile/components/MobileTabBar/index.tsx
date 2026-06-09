import { TabBar } from "antd-mobile"
import { memo, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { IconDiamond } from "@tabler/icons-react"
import { useAdminStore } from "@admin/stores/admin"
import { RouteName, RoutePath } from "@admin/const/routes"
import { useAdmin } from "@admin/provider/AdminProvider"
import { PLATFORM_MANAGEMENT } from "@admin/const/common"
import { useStyles } from "./styles"

enum TabBarKey {
	Platform = RouteName.AdminPlatformLayout,
}

interface TabBarItem {
	key: TabBarKey
	icon: React.ReactNode
	activeIcon?: React.ReactNode
	title: string
	path: string
	hidden?: boolean
}

function getActiveKeyFromPath(pathname: string, items: TabBarItem[]): TabBarKey | undefined {
	const item = items.find((p) => pathname.startsWith(p.path))
	return item?.key
}

const MobileTabBar = memo(() => {
	const { styles } = useStyles({ safeAreaInsetBottom: 0 })
	const { t } = useTranslation("admin/common")
	const location = useLocation()

	const { isOfficialOrg, userPermissions, permissionsKeys } = useAdminStore()
	const { navigate } = useAdmin()

	const tabItems = useMemo<TabBarItem[]>(
		() => [
			{
				key: TabBarKey.Platform,
				icon: <IconDiamond size={24} />,
				title: t("nav.platform"),
				path: RoutePath.Platform,
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

	const visibleItems = useMemo(() => tabItems.filter((item) => !item.hidden), [tabItems])

	const activeKey = useMemo(() => {
		return getActiveKeyFromPath(location.pathname, visibleItems)
	}, [location.pathname, visibleItems])

	const handleTabChange = (key: string) => {
		navigate({
			name: key,
			viewTransition: {
				direction: "right",
			},
			replace: true,
		})
	}

	if (visibleItems.length === 0) {
		return null
	}

	return (
		<TabBar className={styles.tabBar} activeKey={activeKey} onChange={handleTabChange}>
			{visibleItems.map((item) => (
				<TabBar.Item key={item.key} icon={item.icon} title={item.title} />
			))}
		</TabBar>
	)
})

export default MobileTabBar
