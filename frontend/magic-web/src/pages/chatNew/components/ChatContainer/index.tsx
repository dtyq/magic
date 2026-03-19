import { Flex } from "antd"
import { Suspense, lazy } from "react"
import { observer } from "mobx-react-lite"
import MagicSplitter from "@/components/base/MagicSplitter"
import ChatSubSider from "../ChatSubSider"
import MainContent from "../MainContent"
import ChatImagePreviewModal from "../ChatImagePreviewModal"
import conversationStore from "@/stores/chatNew/conversation"
import { interfaceStore } from "@/stores/interface"
import MessageFilePreviewStore from "@/stores/chatNew/messagePreview/FilePreviewStore"
import { ChatDomId } from "../../constants"
import { useStyles } from "../../styles"
import { usePanelSizes } from "../../hooks/usePanelSizes"

// 懒加载组件
const ChatFilePreviewPanel = lazy(() => import("../ChatFilePreviewPanel"))
const GroupSeenPanel = lazy(() => import("../GroupSeenPanel"))

/**
 * 聊天容器组件
 * 包含完整的聊天界面布局
 */
const ChatContainer = observer(function ChatContainer() {
	const { styles } = useStyles()

	const { sizes, totalWidth, mainMinWidth, handleSiderResize, handleInputResize } =
		usePanelSizes()
	const siderSize = sizes[0] ?? interfaceStore.chatSiderDefaultWidth

	return (
		<Flex flex={1} className={styles.chat} id={ChatDomId.ChatContainer}>
			<MagicSplitter onResize={handleSiderResize}>
				<MagicSplitter.Panel
					min={200}
					defaultSize={interfaceStore.chatSiderDefaultWidth}
					size={siderSize}
					max={300}
				>
					<ChatSubSider />
				</MagicSplitter.Panel>
				<MagicSplitter.Panel size={sizes[1]} className={styles.mainSplitterPanel}>
					<MainContent onInputResize={handleInputResize} style={{ height: "100%" }} />
				</MagicSplitter.Panel>
				{MessageFilePreviewStore.open && (
					<MagicSplitter.Panel
						max={totalWidth - siderSize - mainMinWidth}
						min="20%"
						size={sizes[2]}
					>
						<Suspense fallback={null}>
							<ChatFilePreviewPanel className={styles.previewPanel} />
						</Suspense>
					</MagicSplitter.Panel>
				)}
			</MagicSplitter>
			<ChatImagePreviewModal />
			{conversationStore.currentConversation?.isGroupConversation && (
				<Suspense fallback={null}>
					<GroupSeenPanel />
				</Suspense>
			)}
		</Flex>
	)
})

export default ChatContainer
