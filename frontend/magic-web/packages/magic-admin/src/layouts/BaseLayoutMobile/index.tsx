import { ConfigProvider } from "antd-mobile"
import { Outlet } from "react-router-dom"
import { useStyles } from "./styles"
import MobileTabBar from "./components/MobileTabBar"
import MobileHeader from "./components/MobileHeader"
import { withAuthMiddleware } from "../BaseLayout/components/AuthMiddleware"
import { useGetCurrentRouteInfo } from "../BaseLayout/useGetCurrentRouteInfo"

const BaseLayoutMobile = () => {
	const { styles } = useStyles()
	const { hiddenMenu } = useGetCurrentRouteInfo()

	return (
		<ConfigProvider>
			{/* <GlobalSafeArea direction="top" /> */}
			<MobileHeader />
			<div
				className={styles.container}
				style={{ height: hiddenMenu ? "calc(100% - 56px)" : "calc(100% - 56px - 52px)" }}
			>
				<Outlet />
			</div>
			{!hiddenMenu && <MobileTabBar />}
			{/* <GlobalSafeArea direction="bottom" /> */}
		</ConfigProvider>
	)
}
export default withAuthMiddleware(BaseLayoutMobile)
