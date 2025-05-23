import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import TextAnimation from "@/opensource/components/animations/TextAnimation"
import { Flex } from "antd"
import {
	AggregateAISearchCardDeepLevel,
	type AggregateAISearchCardSearch,
} from "@/types/chat/conversation_message"
import useStyles from "../../styles"
import SearchAnimation from "@/opensource/components/animations/SearchAnimation"
import SearchingQuestion from "../SearchQuestion"

interface ReadingProps {
	deepLevel?: number | null
	allPages: AggregateAISearchCardSearch[] | undefined
}

const Reading = memo(({ deepLevel = 1, allPages }: ReadingProps) => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const title = useMemo(() => {
		switch (deepLevel) {
			case AggregateAISearchCardDeepLevel.Deep:
				return (
					<TextAnimation dotwaveAnimation gradientAnimation>
						{t("chat.aggregate_ai_search_card.deep_reading")}
					</TextAnimation>
				)

			case AggregateAISearchCardDeepLevel.Simple:
			default:
				return (
					<SearchingQuestion
						readingText={t("chat.aggregate_ai_search_card.reading_pages")}
						dotwaveAnimation
						searchArray={allPages?.map((i) => i.name)}
					/>
				)
		}
	}, [allPages, deepLevel, t])

	return (
		<Flex gap={8} className={styles.collapsedSummary}>
			<SearchAnimation size={20} />
			{title}
		</Flex>
	)
})

export default Reading
