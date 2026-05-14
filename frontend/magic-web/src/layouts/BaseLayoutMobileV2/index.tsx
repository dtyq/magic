import { ConfigProvider } from "antd-mobile"
import { useKeepAlive } from "@/hooks/router/useKeepAlive"
import { useStyles } from "@/layouts/BaseLayoutMobile/styles"
import { useMemo } from "react"
import { useLocation } from "react-router"
import { useNativeBack } from "@/layouts/BaseLayoutMobile/hooks"
import GlobalSafeArea from "@/layouts/BaseLayoutMobile/components/GlobalSafeArea"
import { observer } from "mobx-react-lite"
import { useGlobalSafeArea } from "@/hooks/useGlobalSafeArea"
import { shouldDisableGlobalSafeArea } from "@/layouts/BaseLayoutMobile/components/GlobalSafeArea/utils"
import { OrganizationSwitchPanel } from "@/layouts/BaseLayoutMobile/components/OrganizationSwitch"

/**
 * 移动端布局 V2：与 `BaseLayoutMobile`（V1）平级，由 `BaseLayout` 按 `shouldUseMobileLayoutV2` 分流。
 *
 * 与 V1 差异（首版刻意收敛，按需再对照 V1 补）：
 * - 无 `MobileTabBar`
 * - 无 MultiFolderUploadToast / NavigatePopup / ShareManagementContainer / MemberCard 根点击
 * - `keepAliveRoutes` 独立，首阶段为空
 */
const BaseLayoutMobileV2 = () => {
	const location = useLocation()
	const { styles, cx } = useStyles()

	useNativeBack()
	useGlobalSafeArea()

	const { Content } = useKeepAlive({
		keepAliveRoutes: [],
	})

	const isNoGlobalSafeArea = useMemo(() => {
		return shouldDisableGlobalSafeArea(location.pathname, location.search)
	}, [location.pathname, location.search])

	return (
		<ConfigProvider>
			<GlobalSafeArea direction="top" />
			<div
				data-testid="base-layout-mobile-v2-root"
				className={cx(styles.container, {
					[styles.noGlobalSafeAreaWithoutTabBar]: isNoGlobalSafeArea,
				})}
			>
				{Content}
			</div>
			<GlobalSafeArea direction="bottom" />
			<OrganizationSwitchPanel />
		</ConfigProvider>
	)
}

export default observer(BaseLayoutMobileV2)
