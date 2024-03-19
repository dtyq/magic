import {
	RecordSummaryStatus,
	type RecordSummaryConversationMessage,
} from "@/opensource/types/chat/conversation_message"
import { useMemo } from "react"
import { Flex } from "antd"
import TextAnimation from "@/opensource/components/animations/TextAnimation"
import { useTyping } from "@/opensource/hooks/useTyping"
import { useUpdateEffect } from "ahooks"
import { IconMicrophone } from "@tabler/icons-react"
import { observer } from "mobx-react-lite"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import useHeader from "./hooks/useHeader"
import useFooter from "./hooks/useFooter"
import useContent from "./hooks/useContent"
import useStyles from "./styles"
import useTranslate from "./hooks/useTranslate"

type MagicRecordSummaryProps = {
	data?: RecordSummaryConversationMessage
}

const MagicRecordSummary = observer(({ data }: MagicRecordSummaryProps) => {
	const { fontSize } = useFontSize()

	const messageContent = useMemo(() => {
		return data?.recording_summary
	}, [data?.recording_summary])

	const { add, start, content: streamContent, done } = useTyping(messageContent?.full_text)

	const { styles } = useStyles({ fontSize })

	const status = useMemo(() => {
		return data?.recording_summary?.status
	}, [data])

	useUpdateEffect(() => {
		if (status === RecordSummaryStatus.Summarized) {
			done()
			add(messageContent?.ai_result || "")
			start()
			return
		}
		if (messageContent?.text) {
			add(messageContent?.text)
			start()
		}
	}, [messageContent?.text, status])

	const { title, duration, RightIcon, messageTimeStr } = useHeader({
		message: data,
		messageContent,
	})

	const { clearIntervalFn } = useTranslate({ status, message: data })

	const { footerBtn, footerOriginContent } = useFooter({
		status,
		messageContent,
		message: data,
		clearIntervalFn,
	})

	const { doingText, AIResult } = useContent({ status, messageContent })

	return (
		<div className={styles.container}>
			<Flex className={styles.header} align="center" justify="space-between">
				<Flex align="flex-start" gap={8}>
					<IconMicrophone color="#fff" size={20} className={styles.headerIcon} />
					<Flex className={styles.title} vertical align="flex-start">
						{title}
						{status === RecordSummaryStatus.Summarized && (
							<span className={styles.aiResultTime}>{messageTimeStr}</span>
						)}
					</Flex>
				</Flex>
				<Flex className={styles.durationTips} align="center" gap={4}>
					{RightIcon}
					{status !== RecordSummaryStatus.Summarized && (
						<span className={styles.duration}>{duration}</span>
					)}
				</Flex>
			</Flex>
			<Flex className={styles.body} vertical align="center" justify="center">
				{AIResult}
				{status !== RecordSummaryStatus.Summarized && (
					<span className={styles.translateText}>{streamContent}</span>
				)}
				<TextAnimation
					dotwaveAnimation={doingText}
					gradientAnimation
					className={styles.doingText}
				>
					{doingText}
				</TextAnimation>
			</Flex>
			{footerBtn}
			{footerOriginContent}
		</div>
	)
})

export default MagicRecordSummary
