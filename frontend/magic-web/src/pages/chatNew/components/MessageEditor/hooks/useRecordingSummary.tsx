import {
	ConversationMessageType,
	RecordSummaryStatus,
} from "@/types/chat/conversation_message"
import { useMemoizedFn, useNetwork } from "ahooks"
import { useMemo } from "react"
import MagicIcon from "@/components/base/MagicIcon"
import { IconMicrophone } from "@tabler/icons-react"
import MessageService from "@/services/chat/message/MessageService"
import ReferMessageStore from "@/stores/chatNew/messageUI/Reply"
import { userStore } from "@/models/user"
import { ChatWebSocket } from "@/apis/clients/chatWebSocket"

type UseRecordingSummaryProps = {
	conversationId?: string
}

const enum ReadyState {
	UNINSTANTIATED = -1,
	CONNECTING = 0,
	OPEN = 1,
	CLOSING = 2,
	CLOSED = 3,
}

export default function useRecordingSummary({ conversationId }: UseRecordingSummaryProps) {
	// useChatStore 已废弃，需重新实现
	// const { isRecording, updateIsRecording } = useChatStore((s) => s)
	const { online } = useNetwork()
	const uId = userStore.user.userInfo?.user_id

	const startRecordingSummary = useMemoizedFn(async () => {
		if (!conversationId) {
			console.error("conversation is null")
			return
		}
		if (!uId) {
			console.error("uId is null")
			return
		}
		// if (!isRecording) {
		// FIXME: 需要使用 ChatWebSocket 的实例
		// @ts-ignore
		const socket = ChatWebSocket.getWebSocket()
		// @ts-ignore
		if (online && socket?.readyState === ReadyState.OPEN) {
			// updateIsRecording(true)
			MessageService.formatAndSendMessage(
				conversationId,
				{
					type: ConversationMessageType.RecordingSummary,
					recording_summary: {
						status: RecordSummaryStatus.Start,
					},
				},
				ReferMessageStore.replyMessageId,
				// EventType.Stream
			)
		}
		// }
	})

	const RecordingSummaryButton = useMemo(() => {
		// return isRecording ? (
		// <ScaleLoader />
		// ) : (
		return <MagicIcon color="currentColor" size={20} component={IconMicrophone} />
		// )
	}, [])

	return {
		startRecordingSummary,
		RecordingSummaryButton,
	}
}
