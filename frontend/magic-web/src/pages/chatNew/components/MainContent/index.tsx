import { Flex } from "antd"
import { Suspense, lazy, type CSSProperties } from "react"
import { observer } from "mobx-react-lite"
import MagicSplitter from "@/components/base/MagicSplitter"
import ChatMessageList from "../ChatMessageList"
import Header from "../ChatHeader"
import DragFileSendTip from "../ChatMessageList/components/DragFileSendTip"
import MessageEditor from "../MessageEditor"
import StartPageContent from "./components/StartPageContent"
import conversationStore from "@/stores/chatNew/conversation"
import ConversationBotDataService from "@/services/chat/conversation/ConversationBotDataService"
import { interfaceStore } from "@/stores/interface"
import { useStyles } from "../../styles"
import startPageStore from "@/stores/chatNew/startPage"

// 懒加载组件
const TopicExtraSection = lazy(() => import("../topic/ExtraSection"))
const SettingExtraSection = lazy(() => import("../setting"))

interface MainContentProps {
	onInputResize: (size: number[]) => void
	style?: CSSProperties
}

/**
 * 聊天主内容区域组件
 * 包含头部、消息列表、输入框以及额外的侧边栏
 */
const MainContent = observer(function MainContent({ onInputResize, style }: MainContentProps) {
	const { styles } = useStyles()
	const showExtra = conversationStore.topicOpen

	// MobX observer会自动追踪这些依赖的变化
	const showStartPage =
		ConversationBotDataService.agentId &&
		startPageStore.StartPageMap.get(ConversationBotDataService.agentId) &&
		ConversationBotDataService.startPage

	const shouldRenderStartPageContent = showStartPage

	// 如果开启了startPage，则显示startPage
	if (shouldRenderStartPageContent)
		return <StartPageContent agentName={ConversationBotDataService.agentName} />

	return (
		<Flex style={style}>
			<MagicSplitter layout="vertical" className={styles.main} onResizeEnd={onInputResize}>
				<MagicSplitter.Panel min={60} defaultSize={60} max={60}>
					<Header />
				</MagicSplitter.Panel>
				<MagicSplitter.Panel>
					<div className={styles.chatList}>
						<DragFileSendTip>
							<ChatMessageList />
						</DragFileSendTip>
					</div>
				</MagicSplitter.Panel>
				<MagicSplitter.Panel
					min={200}
					defaultSize={interfaceStore.chatInputDefaultHeight}
					max="50%"
				>
					<div className={styles.editor}>
						<MessageEditor visible sendWhenEnter />
					</div>
				</MagicSplitter.Panel>
			</MagicSplitter>
			{showExtra && (
				<div className={styles.extra}>
					<Suspense fallback={null}>
						{conversationStore.topicOpen && <TopicExtraSection />}
					</Suspense>
				</div>
			)}
			{conversationStore.settingOpen && (
				<Suspense fallback={null}>
					<SettingExtraSection />
				</Suspense>
			)}
		</Flex>
	)
})

export default MainContent
