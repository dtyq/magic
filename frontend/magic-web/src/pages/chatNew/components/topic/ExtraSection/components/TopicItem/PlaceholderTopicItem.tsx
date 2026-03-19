import MagicIcon from "@/components/base/MagicIcon"
import { IconMessageTopic } from "@/enhance/tabler/icons-react"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { memo } from "react"
import { useTopicItemStyles } from "./useTopicItemStyles"

export default memo(function PlaceholderTopicItem() {
	const { styles, cx } = useTopicItemStyles()
	const { t } = useTranslation("interface")

	return (
		<div className={cx(styles.container, styles.active)}>
			<Flex align="center" gap={4}>
				<MagicIcon component={IconMessageTopic} size={24} />
				<span className={styles.topicTitle}>{t("chat.topic.newTopic")}</span>
			</Flex>
		</div>
	)
})
