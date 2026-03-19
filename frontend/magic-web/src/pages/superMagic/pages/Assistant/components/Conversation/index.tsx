import ChatMessageList from "@/pages/chatNew/components/ChatMessageList"
import DragFileSendTip from "@/pages/chatNew/components/ChatMessageList/components/DragFileSendTip"
import { observer } from "mobx-react-lite"
import { useStyles } from "./styles"
import MessageEditor from "./components/MessageEditor"
import Header from "./components/Header"
import { useRef, lazy, useMemo } from "react"
import { useSize } from "ahooks"
import ChatImagePreviewModal from "@/pages/chatNew/components/ChatImagePreviewModal"
import FlexBox from "@/components/base/FlexBox"
import TopicPanel from "../TopicPanel"
import { ChatDomId } from "@/pages/chatNew/constants"
import ConversationStore from "@/stores/chatNew/conversation"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { useTranslation } from "react-i18next"
import { computed } from "mobx"

const MessageRender = lazy(() =>
	import("./components/MessageRender").then((module) => ({
		default: module.default as React.LazyExoticComponent<React.ComponentType<any>>,
	})),
)

const AiConversationMessageLoading = lazy(() =>
	import("./components/AiConversationMessageLoading").then((module) => ({
		default: module.default as unknown as React.LazyExoticComponent<React.ComponentType<any>>,
	})),
)

function Conversation() {
	const { styles } = useStyles()
	const domRef = useRef<HTMLDivElement>(null)
	const size = useSize(domRef)
	const { t } = useTranslation("super")

	const placeholder = useMemo(() => {
		return computed(() => {
			return superMagicModeService.getModePlaceholderWithLegacy("chat", t)
		}).get()
	}, [t])

	if (!ConversationStore.currentConversation?.id) {
		return null
	}

	return (
		<FlexBox className={styles.wrapper} id={ChatDomId.SuperMagicChatContainer}>
			<div className={styles.container}>
				<div className={styles.header}>
					<Header />
				</div>
				<div
					className={styles.chatList}
					style={{ paddingBottom: size?.height ? size?.height + 20 : undefined }}
				>
					<DragFileSendTip>
						<ChatMessageList
							MessageRender={MessageRender}
							AiConversationMessageLoading={AiConversationMessageLoading}
						/>
					</DragFileSendTip>
				</div>
				<div ref={domRef} className={styles.messageEditor}>
					<div className={styles.messageEditorContainer}>
						<MessageEditor size="small" placeholder={placeholder} />
					</div>
				</div>
				<ChatImagePreviewModal />
			</div>
			<TopicPanel />
		</FlexBox>
	)
}

export default observer(Conversation)
