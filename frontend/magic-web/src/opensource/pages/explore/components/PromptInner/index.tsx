import { Flex } from "antd"
import { createStyles } from "antd-style"

import MagicEmpty from "@/opensource/components/base/MagicEmpty"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useMemo } from "react"
import { useSize } from "ahooks"
import { useTranslation } from "react-i18next"
import type { PromptCard as PromptCardType } from "../PromptCard/types"
import PromptCard from "../PromptCard"

const useStyles = createStyles(({ css, isDarkMode, token }, { colSpan }: { colSpan: number }) => {
	return {
		container: {
			width: "100%",
			background: token.magicColorScales.grey[0],
			borderRadius: 12,
			height: "unset",
			boxShadow: "none !important",
			padding: "0 20px 20px",
		},
		empty: {
			width: "100%",
		},
		header: css`
			padding-top: 20px;
		`,
		title: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			font-size: 18px;
			font-weight: 600;
			line-height: 24px;
			margin-bottom: 2px;
		`,
		desc: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[3]};
			font-size: 14px;
			margin: 0;
			line-height: 20px;
		`,
		spin: css`
			justify-content: flex-start;
		`,
		card: css`
			flex: 1 1 calc((100% - 12px * (${colSpan} - 1)) / ${colSpan});
			max-width: calc((100% - 12px * (${colSpan} - 1)) / ${colSpan});
			padding: 6px;
			border-radius: 8px;
			cursor: pointer;
			&:hover {
				background: ${isDarkMode
					? token.magicColorUsages.fill[0]
					: token.magicColorUsages.fill[0]};
			}
		`,
	}
})

interface PromptInnerProps {
	cards: PromptCardType[]
	loading?: boolean
	onCardClick?: (id: string) => void
}

function PropmtInner({ cards, loading = false, onCardClick }: PromptInnerProps) {
	const { t } = useTranslation("interface")

	const size = useSize(document.body)

	const colSpan = useMemo(() => {
		if (size?.width) {
			if (size.width < 400) {
				return 1
			}

			if (size.width <= 969) {
				return 2
			}

			if (size.width <= 1200) {
				return 3
			}

			return 5
		}

		return 5
	}, [size?.width])

	const { styles } = useStyles({ colSpan })

	return (
		<Flex gap={20} vertical className={styles.container}>
			<div className={styles.header}>
				<div className={styles.title}>{t("explore.promptsTitle.innerAssistant")}</div>
				<div className={styles.desc}>{t("explore.promptsDesc.innerAssistant")}</div>
			</div>
			<MagicSpin section spinning={loading} className={styles.spin}>
				{cards.length === 0 && !loading ? <MagicEmpty className={styles.empty} /> : null}
				<Flex gap={12} wrap>
					{cards.length &&
						cards.map((item) => {
							return (
								<div key={item.id} className={styles.card}>
									<PromptCard
										onClick={onCardClick}
										textGap4
										fontSize14
										data={{
											id: item.id,
											title: item.robot_name,
											icon: item.robot_avatar,
											description: item.robot_description,
											nickname: item.created_info?.nickname,
										}}
									/>
								</div>
							)
						})}
				</Flex>
			</MagicSpin>
		</Flex>
	)
}

export default PropmtInner
