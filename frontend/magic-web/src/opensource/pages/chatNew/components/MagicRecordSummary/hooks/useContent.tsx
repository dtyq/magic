/**
 * 中间内容相关状态和行为
 */

import type { RecordSummaryConversationMessage } from "@/opensource/types/chat/conversation_message"
import { RecordSummaryStatus } from "@/opensource/types/chat/conversation_message"
import { get } from "lodash-es"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useFontSize } from "@/opensource/providers/AppearanceProvider/hooks"
import useStyles from "../styles"

type UseContentProps = {
	status?: RecordSummaryStatus
	messageContent: RecordSummaryConversationMessage["recording_summary"]
}

export default function useContent({ status, messageContent }: UseContentProps) {
	const { fontSize } = useFontSize()
	const { styles } = useStyles({ fontSize })
	const { t } = useTranslation("message")

	const doingText = useMemo(() => {
		const map = {
			[RecordSummaryStatus.Start]: t("chat.recording_summary.start_tips"),
			[RecordSummaryStatus.Doing]: t("chat.recording_summary.doing_tips"),
			[RecordSummaryStatus.Summarizing]: t("chat.recording_summary.summarizing_tips"),
			[RecordSummaryStatus.End]: t("chat.recording_summary.end_tips"),
		}
		return get(map, [`${status}`], "")
	}, [status, t])

	const AIResult = useMemo(() => {
		return status === RecordSummaryStatus.Summarized ? (
			<div className={styles.aiResultCard}>
				<div className={styles.aiResultCardTitle}>
					{t("chat.recording_summary.ai_result")}
				</div>
				{messageContent?.ai_result && (
					<div className={styles.aiResultCardContent}>{messageContent?.ai_result}</div>
				)}
			</div>
		) : null
	}, [
		status,
		styles.aiResultCard,
		styles.aiResultCardTitle,
		styles.aiResultCardContent,
		t,
		messageContent?.ai_result,
	])

	return {
		doingText,
		AIResult,
	}
}
