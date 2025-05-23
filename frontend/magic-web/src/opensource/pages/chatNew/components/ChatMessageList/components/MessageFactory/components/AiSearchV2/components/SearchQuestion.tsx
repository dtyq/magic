import TextAnimation from "@/opensource/components/animations/TextAnimation"
import type { HTMLAttributes, ReactNode } from "react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { createStyles } from "antd-style"
import { Flex } from "antd"
import { nanoid } from "nanoid"

interface SearchingQuestionProps extends HTMLAttributes<HTMLDivElement> {
	searchArray?: string[]
	readingText?: ReactNode
	gradientAnimation?: boolean
	dotwaveAnimation?: boolean
}

const useStyles = createStyles(({ css }, { searchArray }: { searchArray?: string[] }) => {
	const animationName = `currentSearchAnimation_${nanoid()}`
	return {
		container: css``,
		reading: css`
			display: inline-block;
			width: fit-content;
			margin-right: 10px;
		`,
		currentSearchAnimation: css`
			@keyframes ${animationName} {
				${searchArray?.map((item, index, array) => {
					return `
							${(index * 100) / array.length}% {
								content: "${item}";
							}
						`
				})}
			}
			display: inline-flex;
			align-items: center;
			width: 300px;

			&::after {
				content: "${searchArray?.[0]}";
				display: inline-block;
				animation: ${animationName} ${(searchArray?.length ?? 0) / 3}s infinite;

				max-width: 300px;
				white-space: nowrap;
				text-overflow: ellipsis;
				overflow: hidden;
			}
		`,
	}
})

const SearchingQuestion = memo(
	({
		searchArray,
		readingText,
		gradientAnimation = true,
		dotwaveAnimation = false,
	}: SearchingQuestionProps) => {
		const { styles } = useStyles({ searchArray })
		const { t } = useTranslation("interface")

		return (
			<Flex className={styles.container} align="center">
				<TextAnimation
					gradientAnimation={gradientAnimation}
					dotwaveAnimation={dotwaveAnimation}
					className={styles.reading}
				>
					{searchArray?.length
						? readingText ?? t("chat.aggregate_ai_search_card.searchingWebPage")
						: t("chat.aggregate_ai_search_card.searching")}
				</TextAnimation>
				<span className={styles.currentSearchAnimation} />
			</Flex>
		)
	},
)

export default SearchingQuestion
