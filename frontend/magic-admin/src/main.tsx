import { StrictMode, useMemo } from "react"
import { createRoot } from "react-dom/client"
import dayjs from "dayjs"
import { BrowserRouter, Navigate } from "react-router-dom"
import useNavigate from "@/hooks/useNavigate"
import "./index.css"
import "dayjs/locale/zh-cn"
import magicClient from "@/apis/clients/magic"
import { AdminComponentsProvider, LanguageType, ThemeType } from "components"
import AdminProvider from "./provider/AdminProvider"
import { AppEnv } from "./provider/AdminProvider/types"
import App from "./App"
import defaultConfig from "./apis/config"

dayjs.locale("zh-cn")

export const localDevConfig = {
	language: LanguageType.zh_CN,
	theme: ThemeType.LIGHT,
	apiClients: {
		magicClient,
	},
	clusterCode: "global",
	basePath: "/admin",
	isPersonalOrganization: false,
	isPrivateDeployment: false,
	organization: defaultConfig.organization,
	user: defaultConfig.user,
	Navigate,
	env: {
		MAGIC_APP_ENV: AppEnv.Test,
		MAGIC_BASE_URL: defaultConfig.services.base_url,
	},
	areaCodes: defaultConfig.areaCodes,
}

function AppWithNavigate() {
	const navigate = useNavigate()

	const config = useMemo(() => {
		return {
			navigate,
			...localDevConfig,
		}
	}, [navigate])

	return (
		<AdminProvider {...config}>
			<AdminComponentsProvider language={localDevConfig.language} theme={ThemeType.LIGHT}>
				<App />
			</AdminComponentsProvider>
		</AdminProvider>
	)
}

const root = createRoot(document.getElementById("root")!)
root.render(
	<StrictMode>
		<BrowserRouter>
			<AppWithNavigate />
		</BrowserRouter>
	</StrictMode>,
)
