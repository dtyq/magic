import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconMessage2Plus } from "@tabler/icons-react"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { memo } from "react"
import { useMemoizedFn } from "ahooks"
import chatTopicService from "@/opensource/services/chat/topic"
import { useTopicItemStyles } from "./useTopicItemStyles"

const CreateTopicItem = () => {
	const { styles, cx } = useTopicItemStyles()
	const { t } = useTranslation("interface")

	const onCreateTopic = useMemoizedFn(() => {
		chatTopicService.createTopic()
	})

	return (
		<div className={cx(styles.container)} onClick={onCreateTopic}>
			<Flex align="center" gap={4}>
				<MagicIcon component={IconMessage2Plus} size={24} />
				<span className={styles.topicTitle}>{t("chat.topic.createTopic")}</span>
			</Flex>
		</div>
	)
}

export default memo(CreateTopicItem)
