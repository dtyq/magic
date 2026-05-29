import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useMemo, useEffect, memo } from "react"
import { IconStack2, IconWand } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Flex, Segmented } from "antd"
import { MagicSelect, ThemeType, TopMenu } from "@admin-components"
import AtLogo from "@admin/assets/logos/favicon.svg"
import { RoutePath } from "@admin/const/routes"
import { useAdminStore } from "@admin/stores/admin"
import { useUserStore } from "@admin/stores/user"
import { PLATFORM_MANAGEMENT, AI_MANAGEMENT } from "@admin/const/common"
import { useStyles } from "./styles"
import { withAuthMiddleware } from "./components/AuthMiddleware"
import { languageOptions, organizationOptions, themeOptions } from "./const"
import { useGetCurrentRouteInfo } from "./useGetCurrentRouteInfo"
import { useIsMobile } from "@admin/hooks/useIsMobile"
import BaseLayoutMobile from "../BaseLayoutMobile"

function BaseLayoutPc() {
	const { t } = useTranslation("common")

	const location = useLocation()
	const navigate = useNavigate()
	const { styles, cx } = useStyles()
	const { currentOrganizationKey, language, theme, switchOrganization, setLanguage, setTheme } =
		useUserStore()

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
			{
				key: RoutePath.AI,
				label: t("nav.ai"),
				icon: <IconWand size={20} />,
				hidden: !userPermissions.some((permission) => AI_MANAGEMENT.includes(permission)),
			},
		],

		// eslint-disable-next-line react-hooks/exhaustive-deps
		[t, isOfficialOrg, permissionsKeys],
	)

	const { currentRouteItems, hiddenMenu } = useGetCurrentRouteInfo()

	// 使用 useEffect 处理副作用
	useEffect(() => {
		setCurrentRouteItems(currentRouteItems)
	}, [currentRouteItems, setCurrentRouteItems])

	return (
		<div className={styles.layout}>
			{!hiddenMenu && (
				<div className={styles.header}>
					<Flex gap={8} align="center" className={styles.logo}>
						<img src={AtLogo} alt="atLogo" width={40} />
						<div className={styles.title}>{t("title")}</div>
					</Flex>
					<div className={styles.menuWrapper}>
						<TopMenu items={items} pathname={location.pathname} navigate={navigate} />
					</div>
					<Flex gap={8} align="center" className={styles.actions}>
						<MagicSelect
							value={currentOrganizationKey}
							options={organizationOptions}
							onChange={switchOrganization}
							className={styles.orgSelect}
						/>
						<MagicSelect
							value={language}
							options={languageOptions}
							onChange={setLanguage}
							className={styles.langSelect}
						/>
						<Segmented
							size="small"
							value={theme}
							options={themeOptions}
							onChange={(value) => setTheme(value as ThemeType)}
						/>
					</Flex>
				</div>
			)}
			<div className={cx(!hiddenMenu ? styles.wrapper : styles.wrapperWithoutMenu)}>
				<Outlet />
			</div>
		</div>
	)
}

const BaseLayoutPcObserver = withAuthMiddleware(BaseLayoutPc)

const BaseLayout = memo(() => {
	const isMobile = useIsMobile()

	return isMobile ? <BaseLayoutMobile /> : <BaseLayoutPcObserver />
})

export default BaseLayout
