import { App as AntdApp } from "antd"
import { AppRoutes } from "./routes"
import { BrowserRouter } from "./routes/Router"
import { ClusterProvider } from "@/providers/ClusterProvider"
import GlobalErrorBoundary from "@/components/fallback/GlobalErrorBoundary"
import LoadingFallback from "@/components/fallback/LoadingFallback"
import AppearanceProvider from "./providers/AppearanceProvider"

function App() {
	return (
		<AppearanceProvider>
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
			</AntdApp>
		</AppearanceProvider>
	)
}

export default App
