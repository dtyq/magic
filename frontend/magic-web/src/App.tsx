import { App as AntdApp } from "antd"
import { AppRoutes } from "./routes"
import { BrowserRouter } from "./routes/Router"
import { ClusterProvider } from "@/providers/ClusterProvider"
import GlobalErrorBoundary from "@/components/fallback/GlobalErrorBoundary"
import LoadingFallback from "@/components/fallback/LoadingFallback"
import AppearanceProvider from "./providers/AppearanceProvider"
import MaintenanceGuard from "@/components/global/MaintenanceGuard"
import MagicToaster from "./components/base/MagicToaster"
import NetworkTip from "@/components/other/NetworkTip"

function App() {
	return (
		<AppearanceProvider>
			<AntdApp>
				<LoadingFallback>
					<GlobalErrorBoundary>
						<ClusterProvider>
							<BrowserRouter>
								<MaintenanceGuard />
								<AppRoutes />
								<MagicToaster />
								<NetworkTip />
							</BrowserRouter>
						</ClusterProvider>
					</GlobalErrorBoundary>
				</LoadingFallback>
			</AntdApp>
		</AppearanceProvider>
	)
}

export default App
