import { Outlet } from "react-router"
import { RecordSummaryNotificationProvider } from "@/components/business/RecordingSummary/components/RecordSummaryNotification"
import { MobileImagePreviewProvider } from "@/pages/superMagic/components/MessageEditor/components/AtItem/components"
import LowResolutionScaleTip from "@/components/other/LowResolutionScaleTip"
import { logger as Logger } from "@/utils/log"
import { lazy, Suspense, useEffect } from "react"
import { useChatWebSocketConnection } from "@/hooks/useChatWebSocketConnection"
import routeManageService from "@/pages/superMagic/services/routeManageService"
import useNavigate from "@/routes/hooks/useNavigate"
import SwitchingOrganizationLoading from "@/components/fallback/SwitchingOrganizationLoading"

const RecordSummaryServiceListenerModal = lazy(
	() =>
		import("@/components/business/RecordingSummary/components/RecordSummaryServiceListenerModal"),
)

const logger = Logger.createLogger("MagicPlatformLayout")

function MagicPlatformLayoutContent() {
	const navigate = useNavigate()

	useEffect(() => {
		routeManageService.setNavigate(navigate)
		return () => routeManageService.setNavigate(null)
	}, [navigate])

	// Setup WebSocket connection and authentication
	useChatWebSocketConnection({
		autoConnect: true,
		onError: (error) => {
			logger.error("WebSocket 连接或登录失败", error)
		},
	})

	return (
		<SwitchingOrganizationLoading>
			<Outlet />
			<MobileImagePreviewProvider />
			<Suspense fallback={null}>
				<RecordSummaryServiceListenerModal />
			</Suspense>
			<LowResolutionScaleTip />
		</SwitchingOrganizationLoading>
	)
}

export default function MagicPlatformLayout() {
	return (
		<RecordSummaryNotificationProvider>
			<MagicPlatformLayoutContent />
		</RecordSummaryNotificationProvider>
	)
}
