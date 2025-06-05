import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import type { MagicMermaidProps } from "@/opensource/components/base/MagicMermaid/types"
import MagicMermaid from "@/opensource/components/base/MagicMermaid"
import MessageFilePreviewService from "@/opensource/services/chat/message/MessageImagePreview"
import { useMessageRenderContext } from "@/opensource/components/business/MessageRenderProvider/hooks"
import { useConversationMessage } from "@/opensource/pages/chatNew/components/ChatMessageList/components/MessageItem/components/ConversationMessageProvider/hooks"
import { observer } from "mobx-react-lite"
import conversationStore from "@/opensource/stores/chatNew/conversation"
import MagicCode from "@/opensource/components/base/MagicCode"
import { CodeRenderProps } from "../../types"

interface MermaidProps extends MagicMermaidProps, CodeRenderProps {
	language: string
}

const Mermaid = observer((props: MermaidProps) => {
	const { hiddenDetail } = useMessageRenderContext()
	const { t } = useTranslation("interface")
	const { messageId } = useConversationMessage()
	const { isStreaming } = props

	const handleClick = useMemoizedFn(async (svgRef) => {
		if (svgRef) {
			const svg = svgRef.innerHTML
			// const base64 = `data:image/svg+xml;base64,${btoa(svg)}`

			MessageFilePreviewService.setPreviewInfo({
				url: svg,
				ext: { ext: "svg", mime: "image/svg+xml" },
				messageId,
				conversationId: conversationStore.currentConversation?.id,
				standalone: true,
			})
		}
	})

	if (hiddenDetail) {
		return t("chat.message.placeholder.mermaid")
	}

	if (isStreaming) {
		return <MagicCode data={props.data} />
	}

	return <MagicMermaid {...props} onClick={handleClick} />
})

export default Mermaid
