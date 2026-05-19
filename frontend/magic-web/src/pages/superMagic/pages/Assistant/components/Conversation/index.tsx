import ChatMessageList from "@/pages/chatNew/components/ChatMessageList"
import DragFileSendTip from "@/pages/chatNew/components/ChatMessageList/components/DragFileSendTip"
import { observer } from "mobx-react-lite"
import MessageEditor from "./components/MessageEditor"
import Header from "./components/Header"
import { useRef, lazy, useMemo } from "react"
import { useSize } from "ahooks"
import ChatImagePreviewModal from "@/pages/chatNew/components/ChatImagePreviewModal"
import TopicPanel from "../TopicPanel"
import { ChatDomId } from "@/pages/chatNew/constants"
import ConversationStore from "@/stores/chatNew/conversation"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { useTranslation } from "react-i18next"
import { computed } from "mobx"
import { cn } from "@/lib/utils"

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

const conversationWrapperClass = cn(
	"flex h-full w-full",
	"[&>div:last-child]:border-r-0 [&>div]:border-r [&>div]:border-border",
)

const messageEditorContainerClass = cn(
	"mx-auto max-w-[768px] rounded-[12px] border border-border bg-muted p-2.5",
	"shadow-[0px_0px_30px_0px_rgba(0,0,0,0.06),0px_0px_1px_0px_rgba(0,0,0,0.3)]",
	"dark:shadow-[0px_0px_30px_0px_rgba(0,0,0,0.35),0px_0px_1px_0px_rgba(255,255,255,0.12)]",
)

function Conversation() {
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
		<div className={conversationWrapperClass} id={ChatDomId.SuperMagicChatContainer}>
			<div className="relative h-full flex-1 bg-muted px-[55px]">
				<div className="absolute inset-x-0 top-0 z-10 h-[50px]">
					<Header />
				</div>
				<div
					className="mx-auto h-full max-w-[768px] pb-[162px] pt-[50px]"
					style={{ paddingBottom: size?.height ? size?.height + 20 : undefined }}
				>
					<DragFileSendTip>
						<ChatMessageList
							MessageRender={MessageRender}
							AiConversationMessageLoading={AiConversationMessageLoading}
						/>
					</DragFileSendTip>
				</div>
				<div
					ref={domRef}
					className="absolute inset-x-0 bottom-0 mx-[55px] mb-5 h-fit max-h-[200px] min-h-[142px]"
				>
					<div className={messageEditorContainerClass}>
						<MessageEditor size="small" placeholder={placeholder} />
					</div>
				</div>
				<ChatImagePreviewModal />
			</div>
			<TopicPanel />
		</div>
	)
}

export default observer(Conversation)
