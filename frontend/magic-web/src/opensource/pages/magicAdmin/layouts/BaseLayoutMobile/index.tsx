import { ConfigProvider } from "antd-mobile"
import { Outlet } from "react-router-dom"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { useStyles } from "./styles"
import MobileTabBar, { TabBarItem } from "./components/MobileTabBar"
import MobileHeader from "./components/MobileHeader"
import GlobalSafeArea from "@/opensource/layouts/BaseLayoutMobile/components/GlobalSafeArea"
import {
	withAuthMiddleware,
	RouteName,
	useAdminStore,
	RoutePath,
	PLATFORM_MANAGEMENT,
} from "@dtyq/magic-admin"
import { observer } from "mobx-react-lite"
import { IconStack2 } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { useMemo } from "react"

const BaseLayoutMobile = () => {
	const { styles } = useStyles()
	const navigate = useNavigate()
	const { t } = useTranslation("admin/common")

	const { isOfficialOrg, userPermissions } = useAdminStore()

	const tabItems = useMemo<TabBarItem[]>(
		() => [
			{
				key: RouteName.AdminPlatformLayout,
				icon: <IconStack2 size={24} />,
				title: t("nav.platform"),
				path: RoutePath.Platform,
				hidden:
					!isOfficialOrg ||
					!userPermissions.some((permission) => PLATFORM_MANAGEMENT.includes(permission)),
			},
		],
		[t, isOfficialOrg, userPermissions],
	)

	return (
		<ConfigProvider>
			<GlobalSafeArea direction="top" />
			<MobileHeader onClick={() => navigate({ name: RouteName.AdminHome })} />
			<div className={styles.container}>
				<Outlet />
			</div>
			<MobileTabBar tabItems={tabItems} />
			<GlobalSafeArea direction="bottom" />
		</ConfigProvider>
	)
}

export default withAuthMiddleware(observer(BaseLayoutMobile))
