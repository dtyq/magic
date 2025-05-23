import { memo, useMemo } from "react"
import TextAnimation from "@/opensource/components/animations/TextAnimation"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { AggregateAISearchCardDeepLevel } from "@/types/chat/conversation_message"
import useStyles from "../../styles"
import SearchAnimation from "@/opensource/components/animations/SearchAnimation"

interface Props {
	deepLevel?: number | null
	hasAssociateQuestions?: boolean
}

const Searching = memo(({ deepLevel = 1, hasAssociateQuestions = false }: Props) => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const title = useMemo(() => {
		switch (deepLevel) {
			case null:
			case AggregateAISearchCardDeepLevel.Simple:
				return t("chat.aggregate_ai_search_card.searching_questions")
			case AggregateAISearchCardDeepLevel.Deep:
				if (hasAssociateQuestions) return t("chat.aggregate_ai_search_card.deep_searching")
				return t("chat.aggregate_ai_search_card.searching_questions")
			default:
				return t("chat.aggregate_ai_search_card.searching_questions")
		}
	}, [deepLevel, hasAssociateQuestions, t])

	return (
		<Flex gap={8} className={styles.collapsedSummary}>
			<SearchAnimation size={20} />
			<TextAnimation dotwaveAnimation gradientAnimation>
				{title}
			</TextAnimation>
		</Flex>
	)
})

export default Searching
