import { lazy, useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { App as AntdApp } from "antd"
import { I18nextProvider } from "react-i18next"
import LoadingFallback from "@/components/fallback/LoadingFallback"
import AppearanceProvider from "@/providers/AppearanceProvider"
import GlobalErrorBoundary from "@/components/fallback/GlobalErrorBoundary"
import { BrowserRouter } from "@/routes/Router"
import { BrowserProvider } from "@/providers/BrowserProvider"
import type { ClusterLoginSession } from "@/layouts/ClusterLayout/cluster-login"
import { i18nStore } from "@/models/config/stores/i18n.store"

import { createService } from "./service"
import { withLoginService } from "../../../layouts/SSOLayout/providers/LoginServiceProvider"

const AccountModal = lazy(() => import("./AccountModal"))

export interface AccountModalParams {
	/** 自定义集群编码，指定集群编码登录 */
	clusterCode?: string
	/** 订阅集群编码更新 */
	onClusterChange?: (code: string) => void
	/** 嵌套浮层场景可显式抬高账号弹窗层级，避免被调用方弹层遮挡。 */
	zIndex?: number
}

let activeModal: ClusterLoginSession | null = null

const AccountView = (props: { onClose: () => void } & AccountModalParams) => {
	const [open, setOpen] = useState(false)

	useEffect(() => {
		setTimeout(() => {
			setOpen(true)
		}, 300)
	}, [])

	return (
		<BrowserRouter>
			<LoadingFallback>
				<AppearanceProvider>
					<GlobalErrorBoundary>
						<AntdApp>
							<AccountModal
								onClose={props?.onClose}
								open={open}
								clusterCode={props?.clusterCode}
								onClusterChange={props?.onClusterChange}
								zIndex={props?.zIndex}
							/>
						</AntdApp>
					</GlobalErrorBoundary>
				</AppearanceProvider>
			</LoadingFallback>
		</BrowserRouter>
	)
}

export default function openAccountModal(params?: AccountModalParams): ClusterLoginSession {
	if (activeModal) {
		return activeModal
	}

	const ownedService = createService()
	const Account = withLoginService(AccountView, {
		service: ownedService.service,
		syncFromGlobalClusterCode: false,
		syncClusterConfig: false,
	})

	const root = document.createElement("div")
	document.body.appendChild(root)
	const dom = ReactDOM.createRoot(root)
	let isClosed = false

	const onClose = () => {
		if (isClosed) return
		isClosed = true
		ownedService.dispose()
		dom.unmount()
		root.parentNode?.removeChild(root)
		activeModal = null
	}

	const session: ClusterLoginSession = {
		close: onClose,
	}
	activeModal = session

	dom.render(
		<BrowserProvider>
			<I18nextProvider i18n={i18nStore.i18n.instance}>
				<Account
					onClose={onClose}
					onClusterChange={params?.onClusterChange}
					clusterCode={params?.clusterCode}
					zIndex={params?.zIndex}
				/>
			</I18nextProvider>
		</BrowserProvider>,
	)

	return session
}
