import { App as AntdApp } from "antd"
import { BrowserRouter } from "react-router-dom"
import { ClusterProvider } from "@/opensource/providers/ClusterProvider"
import GlobalErrorBoundary from "@/opensource/components/fallback/GlobalErrorBoundary"
import LoadingFallback from "@/opensource/components/fallback/LoadingFallback"
import AppearanceProvider from "./providers/AppearanceProvider"
import ConfigProvider from "./providers/ConfigProvider"
import { AppRoutes } from "./routes"
import "./index.css"

function App() {
	return (
		<BrowserRouter>
			<AppearanceProvider>
				<ConfigProvider>
					<AntdApp>
						<LoadingFallback>
							<GlobalErrorBoundary>
								<ClusterProvider>
									<AppRoutes />
								</ClusterProvider>
							</GlobalErrorBoundary>
						</LoadingFallback>
					</AntdApp>
				</ConfigProvider>
			</AppearanceProvider>
		</BrowserRouter>
	)
}

export default App
