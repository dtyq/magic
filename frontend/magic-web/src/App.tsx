import { App as AntdApp } from "antd"
import { AppRoutes } from "./routes"
import { BrowserRouter } from "./routes/Router"
import { ClusterProvider } from "@/providers/ClusterProvider"
import GlobalErrorBoundary from "@/components/fallback/GlobalErrorBoundary"
import LoadingFallback from "@/components/fallback/LoadingFallback"
import AppearanceProvider from "./providers/AppearanceProvider"
import AppInitProvider from "./providers/AppInitProvider"
import { MobileImagePreviewProvider } from "@/pages/superMagic/components/MessageEditor/components/AtItem/components"

function App() {
	return (
		<AppearanceProvider>
			<AppInitProvider>
				<AntdApp>
					<LoadingFallback>
						<GlobalErrorBoundary>
							<ClusterProvider>
								<BrowserRouter>
									<AppRoutes />
								</BrowserRouter>
							</ClusterProvider>
						</GlobalErrorBoundary>
					</LoadingFallback>
					<MobileImagePreviewProvider />
				</AntdApp>
			</AppInitProvider>
		</AppearanceProvider>
	)
}

export default App
