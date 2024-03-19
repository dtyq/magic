import {
	RecordSummaryStatus,
	type RecordSummaryConversationMessage,
} from "@/opensource/types/chat/conversation_message"
import { useMemoizedFn } from "ahooks"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import ChatFileService from "@/opensource/services/chat/file/ChatFileService"
import { formatTime, recorder } from "../helpers/record"
import ScaleLoader from "../components/ScaleLoader"
import AudioPlayer from "../components/AudioPlayer/AudioPlayer"

type UseHeaderProps = {
	message?: RecordSummaryConversationMessage
	messageContent?: RecordSummaryConversationMessage["recording_summary"]
}

export default function useHeader({ message, messageContent }: UseHeaderProps) {
	const { t } = useTranslation("message")
	const getDefaultSummaryTimeStr = useMemoizedFn((timeStr: number, suffix = "") => {
		const date = new Date(timeStr)
		const month = String(date.getMonth() + 1).padStart(2, "0")
		const day = String(date.getDate()).padStart(2, "0")
		return `${month}月${day}日${suffix}`
	})

	const fileInfo = useMemo(() => {
		return ChatFileService.getFileInfoCache(messageContent?.attachments?.[0]?.file_id)
	}, [messageContent?.attachments])

	const messageTimeStr = useMemo(() => {
		const sendTime = message?.send_time ?? 0
		return getDefaultSummaryTimeStr(sendTime * 1000)
	}, [getDefaultSummaryTimeStr, message?.send_time])

	const [duration, setDuration] = useState(message?.recording_summary?.duration || "")

	// 头部标题
	const title = useMemo(() => {
		return message?.recording_summary?.status === RecordSummaryStatus.Summarized
			? message?.recording_summary?.title
			: `${messageTimeStr} ${t("chat.recording_summary.title")}`
	}, [message?.recording_summary?.status, message?.recording_summary?.title, messageTimeStr, t])

	// 右侧录音
	recorder.onprocess = useMemoizedFn((params) => {
		const newDuration = formatTime(params)
		if (newDuration === duration) return
		setDuration(newDuration)
	})

	const hasUrl = useMemo(() => {
		return fileInfo?.url || messageContent?.audio_link
	}, [fileInfo?.url, messageContent?.audio_link])

	const RightIcon = useMemo(() => {
		if (messageContent?.status === RecordSummaryStatus.Summarized && hasUrl)
			return <AudioPlayer audioUrl={fileInfo?.url || messageContent?.audio_link || ""} />
		if (messageContent?.status === RecordSummaryStatus.Doing) return <ScaleLoader />
		return null
	}, [fileInfo?.url, hasUrl, messageContent?.audio_link, messageContent?.status])

	return {
		title,
		duration,
		RightIcon,
		messageTimeStr,
	}
}
