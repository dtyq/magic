import { splitNumber } from "@/utils/number"
import { resolveToString } from "@dtyq/es6-template-strings"

import { Flex } from "antd"
import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import type { AssociateQuestion } from "@/types/chat/conversation_message"
import { TimeLineDotStatus } from "../../const"
import { formatMinutes } from "../../utils"
import TimeLineDot from "../TimeLineDot"
import useStyles from "../../styles"

interface ResultProps {
	deepLevel?: number | null
	associateQuestions?: Record<string, AssociateQuestion>
	pageLength?: number
}

const Result = memo(({ deepLevel = 1, associateQuestions, pageLength = 0 }: ResultProps) => {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	/** 累加总字数 */
	const allWordCount = useMemo(() => {
		return Object.values(associateQuestions ?? {}).reduce(
			(acc, item) => acc + (item.total_words ?? 0),
			0,
		)
	}, [associateQuestions])

	/** 累加检索到的页面总数 */
	const allMatchCount = useMemo(() => {
		return Object.values(associateQuestions ?? {}).reduce(
			(acc, item) => acc + (item.match_count ?? 0),
			0,
		)
	}, [associateQuestions])

	/** 累加阅读的页面总数 */
	const allPageCount = useMemo(() => {
		return Object.values(associateQuestions ?? {}).reduce(
			(acc, item) => acc + (item.page_count ?? 0),
			0,
		)
	}, [associateQuestions])

	const title = useMemo(() => {
		switch (deepLevel) {
			case 2:
				return (
					<Flex vertical gap={2}>
						<span className={styles.searchSummary}>
							{resolveToString(t("chat.aggregate_ai_search_card.searchSummary"), {
								search_count: splitNumber(allMatchCount),
								read_count: splitNumber(allPageCount),
								word_count: splitNumber(allWordCount),
							})}
						</span>
						<span className={styles.searchSummaryTips}>
							{resolveToString(t("chat.aggregate_ai_search_card.searchSummaryTips"), {
								time: `${formatMinutes(allWordCount / 500)}~${formatMinutes(
									allWordCount / 200,
								)}`,
							})}
						</span>
					</Flex>
				)
			case 1:
			default:
				return (
					<span>
						{t("chat.aggregate_ai_search_card.read_pages_count", {
							count: pageLength,
						})}
					</span>
				)
		}
	}, [
		allMatchCount,
		allPageCount,
		allWordCount,
		deepLevel,
		pageLength,
		styles.searchSummary,
		styles.searchSummaryTips,
		t,
	])

	return (
		<Flex gap={8} className={styles.collapsedSummary}>
			<TimeLineDot
				status={TimeLineDotStatus.SUCCESS}
				style={{ transform: "translate(2px,2px)" }}
			/>
			{title}
		</Flex>
	)
})

export default Result
