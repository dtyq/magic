/**
 * 实时向后端推需要进行「翻译」的流，相关状态和行为
 */

import { useState } from "react"
import {
	useAsyncEffect,
	useLatest,
	useMemoizedFn,
	useNetwork,
	useResetState,
	useUnmount,
} from "ahooks"
import type { RecordSummaryConversationMessage } from "@/opensource/types/chat/conversation_message"
import {
	ConversationMessageType,
	RecordSummaryStatus,
} from "@/opensource/types/chat/conversation_message"
import dayjs from "@/opensource/lib/dayjs"
import pako from "pako"
import MessageService from "@/opensource/services/chat/message/MessageService"
import RecordSummaryManager from "@/opensource/services/chat/recordSummary/RecordSummaryManager"
import ConversationStore from "@/opensource/stores/chatNew/conversation"
import ReferMessageStore from "@/opensource/stores/chatNew/messageUI/Reply"
import { blobToBase64Async, recorder, startRecording, stopRecording } from "../helpers/record"
import { ChatWebSocket } from "@/opensource/apis/clients/chatWebSocket"
import { userStore } from "@/opensource/models/user"
type UseTranslateProps = {
	status?: RecordSummaryStatus
	message?: RecordSummaryConversationMessage
}

export default function useTranslate({ status, message }: UseTranslateProps) {
	const { currentConversation: conversation } = ConversationStore
	const uId = userStore.user.userInfo?.user_id
	const [intervalId, setIntervalId] = useState<NodeJS.Timeout>()
	const { online } = useNetwork()

	// 当前发送识别数据的计数数据
	const [count, setCount, resetCount] = useResetState(0)
	const countRef = useLatest(count)

	const sendRecordingSummary = useMemoizedFn(async (blob_data: Blob | Uint8Array) => {
		if (!conversation?.id) {
			console.error("conversation is null")
			return
		}
		if (!uId) {
			console.error("uId is null")
			return
		}
		if (!message?.app_message_id) {
			console.error("app_message_id is null")
			return
		}
		const blobBase64 = await blobToBase64Async(blob_data)
		const isRecognize = count > 3

		const messageContent = {
			type: ConversationMessageType.RecordingSummary,
			recording_summary: {
				status: RecordSummaryStatus.Doing,
				recording_blob: blobBase64,
				is_recognize: isRecognize,
			},
		} as Pick<RecordSummaryConversationMessage, "type" | "recording_summary">

		if (isRecognize) resetCount()

		// 网络在线并且ws连接正常，就直接推送，否则推到消息队列，等到恢复网络且ws连接正常后再进行消费
		// FIXME: 暂时使用不到
		// @ts-ignore
		if (online && ChatWebSocket.getWebSocket()?.readyState === WebSocket.OPEN) {
			MessageService.sendRecordMessage(
				conversation?.id,
				ReferMessageStore.replyMessageId ?? "",
				messageContent,
			)
		} else {
			RecordSummaryManager.addToMessageQueue({
				message: messageContent,
				callFnName: "sendRecordingSummaryMessage",
				sendTime: dayjs().unix(),
			})
		}
	})

	const sendRecordingSummaryData = useMemoizedFn(() => {
		const wavBlob = recorder.getWAVBlob()
		recorder.clearBuffers()
		wavBlob.arrayBuffer().then((buffer: any) => {
			sendRecordingSummary(pako.gzip(buffer))
		})
	})

	const clearIntervalFn = useMemoizedFn(() => {
		if (!intervalId) return
		stopRecording()
		clearInterval(intervalId)
		setIntervalId(undefined)
	})

	useAsyncEffect(async () => {
		if (status === RecordSummaryStatus.Doing && !message?.recording_summary?.full_text) {
			await startRecording()
		}
		if (status === RecordSummaryStatus.Doing && !intervalId) {
			sendRecordingSummaryData()
			const interval = setInterval(() => {
				const latestCount = countRef.current + 1
				setCount(latestCount)
				sendRecordingSummaryData()
			}, 500)
			setIntervalId(interval)
		}
		if (status === RecordSummaryStatus.Summarized) {
			clearIntervalFn()
		}
	}, [status, count])

	useUnmount(() => {
		clearIntervalFn()
	})

	return {
		clearIntervalFn,
	}
}
