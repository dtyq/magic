import { ConfigProvider } from "antd-mobile"
import { Outlet } from "react-router-dom"
import { useAdmin } from "@/provider/AdminProvider"
import { useStyles } from "./styles"
import MobileTabBar from "./components/MobileTabBar"
import MobileHeader from "./components/MobileHeader"
import { withAuthMiddleware } from "../BaseLayout/components/AuthMiddleware"

const BaseLayoutMobile = () => {
	const { safeAreaInset } = useAdmin()
	const { styles } = useStyles({
		safeAreaInsetBottom: safeAreaInset?.bottom || 0,
		safeAreaInsetTop: safeAreaInset?.top || 0,
	})

	return (
		<ConfigProvider>
			{/* <GlobalSafeArea direction="top" /> */}
			<MobileHeader />
			<div className={styles.container}>
				<Outlet />
			</div>
			<MobileTabBar />
			{/* <GlobalSafeArea direction="bottom" /> */}
		</ConfigProvider>
	)
}

export default withAuthMiddleware(BaseLayoutMobile)
