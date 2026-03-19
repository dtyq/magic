import type { RecordSummaryOriginContent } from "@/types/chat/conversation_message"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { useFontSize } from "@/providers/AppearanceProvider/hooks"
import useStyles from "../../styles"

type OriginContentListProps = {
	originContent: RecordSummaryOriginContent
}

export default function OriginContentList({ originContent }: OriginContentListProps) {
	const { fontSize } = useFontSize()
	const { t } = useTranslation("message")
	const { styles } = useStyles({ fontSize })

	return (
		<Flex vertical gap={14} className={styles.originContentList}>
			{originContent.map((item) => {
				return (
					<Flex vertical gap={4} key={item.id}>
						<Flex justify="flex-start" gap={14}>
							<span className={styles.originContentSpeaker}>
								{t("chat.recording_summary.username")} {item.speaker}
							</span>
							<span className={styles.originContentDuration}>{item.duration}</span>
						</Flex>
						<div className={styles.originContentText}>{item.text}</div>
					</Flex>
				)
			})}
		</Flex>
	)
}
