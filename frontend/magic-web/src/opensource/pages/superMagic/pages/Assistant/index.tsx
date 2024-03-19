import Sider from "./components/Sider"
import Conversation from "./components/Conversation"
import Header from "./components/Header"
import { useStyles } from "./styles"
import { createPortal } from "react-dom"
import { useLocation } from "react-router"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { usePanelSizes } from "@/opensource/pages/chatNew/hooks/usePanelSizes"
import MagicSplitter from "@/opensource/components/base/MagicSplitter"
import { Suspense, useMemo, useState, lazy } from "react"
import ChatFilePreviewPanel from "@/opensource/pages/chatNew/components/ChatFilePreviewPanel"
import { interfaceStore } from "@/opensource/stores/interface"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/FilePreviewStore"
import { UserAvailableAgentInfo } from "@/opensource/apis/modules/chat/types"
import { AssistantDataProvider } from "./components/DataProvider"
import { RouteName } from "@/opensource/routes/constants"
import { getRoutePath } from "@/opensource/routes/history/helpers"
import { PORTAL_IDS } from "@/opensource/constants"
import usePortalTarget from "@/opensource/hooks/usePortalTarget"

/**
 * @description 路由处理器，需要异步渲染，等待路由生成再渲染再执行对应业务流程
 */
const Navigate = lazy(() => import("@/opensource/routes/components/Navigate"))

function Assistant() {
	const { styles } = useStyles()
	const location = useLocation()
	const isMobile = useIsMobile()

	const { sizes, totalWidth, mainMinWidth, handleSiderResize } = usePanelSizes()

	const [currentAgent, setCurrentAgent] = useState<UserAvailableAgentInfo | null>(null)

	const value = useMemo(() => ({ selectedAgent: currentAgent }), [currentAgent])

	const headerPortalTarget = usePortalTarget({
		portalId: PORTAL_IDS.SUPER_MAGIC_HEADER_LEFT,
		enabled: location.pathname === getRoutePath({ name: RouteName.SuperAssistant }),
	})

	if (isMobile) {
		return <Navigate name={RouteName.Super} replace />
	}

	return (
		<>
			{headerPortalTarget && createPortal(<Header />, headerPortalTarget)}

			<MagicSplitter onResize={handleSiderResize} className={styles.splitter}>
				<MagicSplitter.Panel
					min={200}
					defaultSize={interfaceStore.chatSiderDefaultWidth}
					size={sizes[0]}
					max={300}
				>
					<Sider onSelectAgent={setCurrentAgent} />
				</MagicSplitter.Panel>
				<MagicSplitter.Panel size={sizes[1]} className={styles.mainSplitterPanel}>
					<AssistantDataProvider value={value}>
						<Conversation />
					</AssistantDataProvider>
				</MagicSplitter.Panel>
				{MessageFilePreviewStore.open && (
					<MagicSplitter.Panel
						max={totalWidth - sizes[0]! - mainMinWidth}
						min="20%"
						size={sizes[2]}
					>
						<Suspense fallback={null}>
							<ChatFilePreviewPanel className={styles.previewPanel} />
						</Suspense>
					</MagicSplitter.Panel>
				)}
			</MagicSplitter>
			{/* <FlexBox className={styles.container}>
				<Sider />
				<Conversation />
				<TopicPanel />
			</FlexBox> */}
		</>
	)
}

export default Assistant
