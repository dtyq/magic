import { useState, useEffect } from "react"
import { IconHourglassEmpty } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { messageFilter } from "../../utils/handleMessage"
import WarningCard from "../MessageList/components/WarningCard"
import TimeoutTips from "./components/TimeoutTips"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ChatApi } from "@/apis"
import { EventType } from "@/types/chat"
import { userStore } from "@/models/user"
import type { Topic } from "../../pages/Workspace/types"
import { useUpdateEffect } from "ahooks"
import topicModelStore from "@/stores/superMagic/topicModelStore"
import { superMagicStore } from "@/pages/superMagic/stores"
import { SendMessageOptions } from "../MessagePanel/types"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { cn } from "@/lib/utils"
import { useMessageListContext } from "../MessageList/context"

const TIMEOUT_THRESHOLD = 60 * 5 // 5分钟
const MAX_TIMEOUT_THRESHOLD = 60 * 60 // 60分钟

const loadingMessageTextClass = cn(
	"relative bg-[length:200%_100%] bg-clip-text text-sm font-normal leading-5 tracking-[0.25px] text-transparent",
	"animate-[skeleton-loading_1.2s_linear_infinite]",
	"bg-[linear-gradient(90deg,#B5B5B5_35%,#060607_50%,#B5B5B5_65%)]",
	"dark:bg-[linear-gradient(90deg,rgba(181,181,181,0.7)_35%,rgba(255,255,255,0.95)_50%,rgba(181,181,181,0.7)_65%)]",
)

interface LoadingMessageProps {
	messages?: Array<any>
	showLoading?: boolean
	style?: React.CSSProperties
	selectedTopic?: Topic | null
	handleSendMsg?: (content: string, options?: SendMessageOptions) => void
}

export default function LoadingMessage({
	messages = [],
	showLoading = true,
	style,
	selectedTopic,
}: LoadingMessageProps) {
	const [elapsedTime, setElapsedTime] = useState(0)
	const [hasTriggeredScroll, setHasTriggeredScroll] = useState(false)
	const [lastMessageKey, setLastMessageKey] = useState<string>("")
	const [confirmDisabled, setConfirmDisabled] = useState(false)
	const [cancelDisabled, setCancelDisabled] = useState(false)

	const { allowCreateNewTopic } = useMessageListContext()

	const { t } = useTranslation("super")

	useEffect(() => {
		const calculateElapsedTime = () => {
			if (!messages || messages.length === 0) {
				setElapsedTime(0)
				setLastMessageKey("")
				return
			}

			// 找到最后一条消息作为开始时间
			const lastMessage = messages
				.filter((msg) => {
					// 过滤条件：有时间戳的消息
					const hasTimestamp = msg.send_time
					// 需要显示的消息才需要计算
					const node = superMagicStore.getMessageNode(msg?.app_message_id)
					const isMessageShow = !messageFilter(node)

					return hasTimestamp && isMessageShow
				})
				.pop() // 获取最后一条消息

			if (!lastMessage) {
				setElapsedTime(0)
				setLastMessageKey("")
				return
			}

			// 生成消息的唯一标识，用于检测新消息
			const messageKey = `${lastMessage.app_message_id || ""}${lastMessage.send_time || ""}`

			// 检测到新消息时，重置触发状态
			if (messageKey !== lastMessageKey) {
				setLastMessageKey(messageKey)
				setHasTriggeredScroll(false)
				// 重置按钮disabled状态
				setConfirmDisabled(false)
				setCancelDisabled(false)
			}

			// 获取开始时间戳，send_timestamp 是秒级时间戳，需要转换为毫秒
			const startTime = new Date(lastMessage.send_time * 1000).getTime()
			if (!lastMessage.send_time) {
				setElapsedTime(0)
				return
			}
			// if (lastMessage.send_timestamp) {
			// 	startTime = lastMessage.send_timestamp * 1000 // 秒级转毫秒级
			// } else if (lastMessage.send_time) {
			// 	if (typeof lastMessage.send_time === "number") {
			// 		// 如果是小于13位数字，认为是秒级时间戳，需要转换为毫秒级
			// 		startTime =
			// 			lastMessage.send_time < 10000000000000
			// 				? lastMessage.send_time * 1000
			// 				: lastMessage.send_time
			// 	} else {
			// 		startTime = new Date(lastMessage.send_time).getTime()
			// 	}
			// } else {
			// 	setElapsedTime(0)
			// 	return
			// }

			// 检查 startTime 是否有效
			if (!Number.isFinite(startTime)) {
				setElapsedTime(0)
				return
			}

			// 使用当前时间作为结束时间
			const endTime = Date.now()

			const elapsed = Math.floor((endTime - startTime) / 1000)
			// 确保计算结果是有效数字
			const safeElapsed = Number.isFinite(elapsed) ? elapsed : 0
			setElapsedTime(Math.max(0, safeElapsed))
		}

		// 立即计算一次
		calculateElapsedTime()

		// 每秒更新一次计时
		const timer = setInterval(calculateElapsedTime, 1000)

		return () => {
			clearInterval(timer)
		}
	}, [messages.length, showLoading, lastMessageKey])

	const formatTime = (seconds: number): string => {
		// 安全检查：确保 seconds 是有效数字
		if (!Number.isFinite(seconds) || seconds < 0) {
			return "00:00"
		}

		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = seconds % 60
		return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
			.toString()
			.padStart(2, "0")}`
	}

	// 发送终止任务的intermediate消息
	const handleSendInterruptMessage = async () => {
		try {
			const { userInfo } = userStore.user

			if (!selectedTopic?.chat_conversation_id || !selectedTopic?.id || !userInfo?.user_id) {
				console.error("缺少必要信息，无法发送终止消息")
				return
			}

			const timestamp = Date.now()

			ChatApi.chat(EventType.Chat, {
				message: {
					type: "rich_text" as any,
					rich_text: {
						content: `{"type":"doc","content":[{"type":"paragraph","attrs":{"suggestion":""},"content":[{"type":"text","text":"${t(
							"common.continue",
						)}"}]}]}`,
						instructs: [
							{
								value: "plan",
							},
						],
						attachments: [],
						extra: {
							super_agent: {
								mentions: [],
								input_mode: "plan",
								chat_mode: "normal",
								topic_pattern: "general",
								model: {
									model_id:
										topicModelStore?.selectedLanguageModel?.model_id || "auto",
								},
							},
						},
					},
					send_timestamp: timestamp,
					send_time: timestamp,
					sender_id: userInfo.user_id,
					topic_id: selectedTopic.chat_topic_id,
				} as any,
				conversation_id: selectedTopic.chat_conversation_id,
			})
		} catch (error) {
			console.error("💥 [LoadingMessage] 发送终止消息失败:", error)
		}
	}

	useUpdateEffect(() => {
		if (elapsedTime >= TIMEOUT_THRESHOLD && !hasTriggeredScroll) {
			setHasTriggeredScroll(true)
			requestAnimationFrame(() => {
				pubsub.publish(PubSubEvents.Message_Scroll_To_Bottom)
			})
		}
	}, [elapsedTime, hasTriggeredScroll])

	// 当超时时间未达到阈值时，重置按钮disabled状态
	useEffect(() => {
		if (elapsedTime < TIMEOUT_THRESHOLD) {
			setConfirmDisabled(false)
			setCancelDisabled(false)
		}
	}, [elapsedTime])

	// 如果超过60分钟，直接返回null
	if (elapsedTime >= MAX_TIMEOUT_THRESHOLD) {
		return null
	}

	return (
		<>
			<span className="ml-1 mt-5 inline-flex items-center gap-1" style={style}>
				<Spinner className="animate-spin" size={16} />
				<span className={loadingMessageTextClass}>{t("ui.thinking")}</span>
				<span className="ml-1 flex h-12 items-center gap-px text-xs font-normal leading-5 tracking-[0.25px] text-foreground/35">
					<IconHourglassEmpty size={16} />
					{formatTime(elapsedTime)}
				</span>
			</span>
			{elapsedTime >= TIMEOUT_THRESHOLD && (
				<WarningCard
					confirmText={t("topic.createNewTopic")}
					cancelText={t("warningCard.tryAgain")}
					confirmDisabled={confirmDisabled}
					cancelDisabled={cancelDisabled}
					onConfirm={
						allowCreateNewTopic
							? () => {
									setConfirmDisabled(true)
									pubsub.publish("send_interrupt_message")
									pubsub.publish("super_magic_create_create_topic")
								}
							: undefined
					}
					onCancel={() => {
						setCancelDisabled(true)
						handleSendInterruptMessage()
					}}
					tips={<TimeoutTips />}
					confirmLoading={confirmDisabled}
					cancelLoading={cancelDisabled}
				/>
			)}
		</>
	)
}
