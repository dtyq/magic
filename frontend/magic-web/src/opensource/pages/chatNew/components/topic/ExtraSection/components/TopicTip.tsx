import { Flex } from "antd"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { useStyles } from "../style"
import TipPicture from "./TipPicture"

const TopicTip = memo(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	return (
		<Flex className={styles.tip} vertical>
			<TipPicture className={styles.tipPicture} />
			<span className={styles.tipTitle}>{t("chat.topic.tip.title")}</span>
			<span className={styles.tipDescription}>{t("chat.topic.tip.description")}</span>
		</Flex>
	)
})

export default TopicTip
