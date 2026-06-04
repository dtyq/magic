import { StrictMode, useMemo } from "react"
import { createRoot } from "react-dom/client"
import dayjs from "dayjs"
import { BrowserRouter, Navigate } from "react-router-dom"
import useNavigate from "@admin/hooks/useNavigate"
import "./index.css"
import "dayjs/locale/zh-cn"
import magicClient from "@admin/apis/clients/magic"
import { AdminComponentsProvider, LanguageType, ThemeType } from "@admin-components"
import { AdminProvider } from "./provider/AdminProvider"
import { AppEnv } from "./provider/AdminProvider/types"
import App from "./App"
import defaultConfig from "./apis/config"
import { useUserStore } from "./stores/user"

dayjs.locale("zh-cn")

// 本地开发配置
export const localDevConfig = {
	language: LanguageType.zh_CN,
	theme: ThemeType.LIGHT,
	apiClients: {
		magicClient,
	},
	clusterCode: "global",
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
	const { currentOrganizationKey, organizationConfigs, language, theme, refreshKey } =
		useUserStore()
	const currentOrganization = organizationConfigs[currentOrganizationKey]

	const config = useMemo(() => {
		return {
			navigate,
			...localDevConfig,
			language,
			theme,
			user: currentOrganization.user,
			organization: currentOrganization.organization,
		}
	}, [currentOrganization, language, navigate, theme])

	return (
		<AdminProvider key={refreshKey} {...config}>
			<AdminComponentsProvider language={language} theme={theme}>
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
