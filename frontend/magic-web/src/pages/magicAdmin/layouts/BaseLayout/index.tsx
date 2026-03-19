import { Outlet, useLocation, useNavigate as useBaseNavigate } from "react-router-dom"
import { memo, useMemo } from "react"
import { IconStack2 } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Flex } from "antd"
import { TopMenu } from "@dtyq/magic-admin/components"
import {
	useAdminStore,
	withAuthMiddleware,
	findRouteByPathname,
	RouteName,
	RoutePath,
	PLATFORM_MANAGEMENT,
} from "@dtyq/magic-admin"
import { useStyles } from "./styles"
import MagicAdminProvider from "@/pages/magicAdmin"
import OrganizationSwitch from "./components/OrganizationSwitch"
import UserMenus from "@/layouts/BaseLayout/components/UserMenus"
import { useUserInfo } from "@/models/user/hooks"
import UserAvatarRender from "@/components/business/UserAvatarRender"
import useNavigate from "@/routes/hooks/useNavigate"
import routes from "@/routes/modules/admin/routes"
import useMetaSet from "@/routes/hooks/useRoutesMetaSet"
import { useIsMobile } from "@/hooks/use-mobile"
import BaseLayoutMobile from "../BaseLayoutMobile"
import { observer } from "mobx-react-lite"
import HeaderLogo from "./components/HeaderLogo"
import { useBaseLayoutPcEffects } from "./hooks"

const BaseLayoutPc = () => {
	const { t } = useTranslation("admin/common")
	const { styles, cx } = useStyles()

	const location = useLocation()
	const { pathname } = location
	const navigate = useNavigate()
	const baseNavigate = useBaseNavigate()

	const { userInfo } = useUserInfo()
	const { isOfficialOrg, userPermissions, permissionsKeys, setCurrentRouteItems } =
		useAdminStore()

	useBaseLayoutPcEffects()

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
		[isOfficialOrg, permissionsKeys, t],
	)

	/* 根据路由项的 hidden 属性，判断是否隐藏顶部菜单 */
	const hiddenMenu = useMemo(() => {
		// 根据 pathname 查找对应的路由项
		const pathSegments = pathname.split("/").filter(Boolean)
		const currentRouteItems = findRouteByPathname(pathSegments, routes)
		setCurrentRouteItems(currentRouteItems)
		return currentRouteItems && currentRouteItems?.hiddenMenu
	}, [pathname, setCurrentRouteItems])

	return (
		<div className={styles.layout}>
			{!hiddenMenu && (
				<div className={styles.header}>
					<Flex
						gap={8}
						align="center"
						className={styles.logo}
						onClick={() => navigate({ name: RouteName.AdminHome })}
					>
						<HeaderLogo width={40} />
						<div className={styles.title}>{t("title")}</div>
					</Flex>
					<TopMenu items={items} pathname={pathname} navigate={baseNavigate} />
					<Flex gap={12} align="center">
						<OrganizationSwitch />
						<UserMenus placement="bottomRight">
							<UserAvatarRender userInfo={userInfo} />
						</UserMenus>
					</Flex>
				</div>
			)}
			<div className={cx(!hiddenMenu ? styles.wrapper : styles.wrapperWithoutMenu)}>
				<Outlet />
			</div>
		</div>
	)
}

const BaseLayoutPcObserver = withAuthMiddleware(observer(BaseLayoutPc))

const BaseLayout = memo(() => {
	useMetaSet()
	const isMobile = useIsMobile()

	return isMobile ? <BaseLayoutMobile /> : <BaseLayoutPcObserver />
})

const BaseLayoutWithProvider = () => {
	return (
		<MagicAdminProvider>
			<BaseLayout />
		</MagicAdminProvider>
	)
}
export default BaseLayoutWithProvider
