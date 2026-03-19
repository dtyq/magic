import type { RecordSummaryConversationMessage } from "@/types/chat/conversation_message"
import {
	ConversationMessageType,
	RecordSummaryStatus,
} from "@/types/chat/conversation_message"
import { Flex } from "antd"
import { get } from "lodash-es"
import { useMemo } from "react"
import { cx } from "antd-style"
import MagicCollapse from "@/components/base/MagicCollapse"
import { useMemoizedFn, useMount } from "ahooks"
import { useTranslation } from "react-i18next"
import RecordSummaryManager from "@/services/chat/recordSummary/RecordSummaryManager"
import MessageService from "@/services/chat/message/MessageService"
import ConversationStore from "@/stores/chatNew/conversation"
import ReferMessageStore from "@/stores/chatNew/messageUI/Reply"
import OriginContentList from "../components/OriginContentList/OriginContentList"
import useStyles from "../styles"
import { recorder } from "../helpers/record"
import { useFontSize } from "@/providers/AppearanceProvider/hooks"
import { userStore } from "@/models/user"
/**
 * 消息卡片尾部按钮的相关状态和行为
 */
type UseFooterProps = {
	status?: RecordSummaryStatus
	messageContent?: RecordSummaryConversationMessage["recording_summary"]
	message?: RecordSummaryConversationMessage
	clearIntervalFn?: () => void
}

export default function useFooter({
	status,
	messageContent,
	message,
	clearIntervalFn,
}: UseFooterProps) {
	const { t } = useTranslation("message")
	const { fontSize } = useFontSize()
	const { styles } = useStyles({ fontSize })

	const { currentConversation: conversation } = ConversationStore

	const btnText = useMemo(() => {
		const map = {
			[RecordSummaryStatus.Doing]: t("chat.recording_summary.doing_btn_text"),
			[RecordSummaryStatus.Summarizing]: t("chat.recording_summary.summarizing_btn_text"),
		}
		return get(map, [`${status}`], "")
	}, [status, t])

	const btnDisabled = useMemo(() => {
		return status === RecordSummaryStatus.Summarized
	}, [status])

	const uId = userStore.user.userInfo?.user_id

	const sendEndRecordingSummary = useMemoizedFn(() => {
		clearIntervalFn?.()
		// recorder.downloadCacheWAV()
		recorder.destroyRecord()
		RecordSummaryManager.updateIsRecording(false)
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
		MessageService.sendRecordMessage(conversation?.id, ReferMessageStore.replyMessageId ?? "", {
			type: ConversationMessageType.RecordingSummary,
			recording_summary: {
				status: RecordSummaryStatus.End,
			},
		})
	})

	const onFooterBtnClick = useMemoizedFn(() => {
		switch (status) {
			case RecordSummaryStatus.Doing:
				// 发送结束录音纪要消息
				sendEndRecordingSummary()
				break
			default:
				break
		}
	})

	const footerBtn = useMemo(() => {
		return (
			<Flex
				className={cx(styles.footerBtn, {
					[styles.disabled]: btnDisabled,
				})}
				align="center"
				justify="center"
				onClick={onFooterBtnClick}
			>
				{btnText}
			</Flex>
		)
	}, [btnDisabled, btnText, onFooterBtnClick, styles.disabled, styles.footerBtn])

	const collapseItems = useMemo(() => {
		if (!messageContent) return []

		const datas = []

		// 如果有事件，则显示事件
		if (messageContent.origin_content && messageContent.origin_content.length > 0) {
			datas.push({
				key: "origin_content",
				label: (
					<Flex align="center" gap={10}>
						{t("chat.recording_summary.origin_content")}
					</Flex>
				),
				children: <OriginContentList originContent={messageContent.origin_content} />,
			})
		}

		return datas
	}, [messageContent, t])

	const footerOriginContent = useMemo(() => {
		return status === RecordSummaryStatus.Summarized ? (
			<MagicCollapse className={styles.collapse} items={collapseItems} />
		) : null
	}, [collapseItems, styles.collapse, status])

	// 初次挂载时（页面刷新时），如何当前消息状态是发送中，且识别结果不为空时（避免是初次新增一条Doing消息），则手动终止
	useMount(() => {
		if (status === RecordSummaryStatus.Doing && messageContent?.full_text) {
			sendEndRecordingSummary()
		}

		// if (status === RecordSummaryStatus.Summarizing && message?.app_message_id) {
		// 	const messageId = recordingSummaryMessageIdMap[message.app_message_id]
		// 	updateMessageContent(messageId, (msg: any) => {
		// 		msg.recording_summary.status = RecordSummaryStatus.Summarized
		// 		msg.recording_summary.ai_result = t("chat.recording_summary.error_tips")
		// 	})
		// }
	})

	return { footerBtn, footerOriginContent }
}
