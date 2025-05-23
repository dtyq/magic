import TextAnimation from "@/opensource/components/animations/TextAnimation"
import { Flex } from "antd"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import useStyles from "../../styles"
import SearchAnimation from "@/opensource/components/animations/SearchAnimation"

const Reasoning = memo(() => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	return (
		<Flex gap={8} className={styles.collapsedSummary}>
			<SearchAnimation size={20} />
			<TextAnimation dotwaveAnimation gradientAnimation>
				{t("chat.aggregate_ai_search_card.reasoning")}
			</TextAnimation>
		</Flex>
	)
})

export default Reasoning
