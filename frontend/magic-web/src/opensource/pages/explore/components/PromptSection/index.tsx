import { Card, Col, Row } from "antd"
import { createStyles } from "antd-style"
import MagicEmpty from "@/opensource/components/base/MagicEmpty"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { useMemo } from "react"
import { useSize } from "ahooks"
import { useTranslation } from "react-i18next"
import PromptCard from "../PromptCard"
import type { PromptSection } from "./types"

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: {
			width: "100%",
			background: "transparent !important",
			height: "unset",
			boxShadow: "none !important",
		},
		empty: {
			width: "100%",
		},
		body: css`
			padding: 0 !important;
		`,
		header: css`
			padding: 12px 12px 0 0 !important;
			border-bottom: 0 !important;
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			font-size: 18px !important;
		`,
		title: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1]};
			font-size: 18px;
			font-weight: 600;
		`,
		desc: css`
			color: ${isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[2]};
			font-size: 14px;
			font-weight: 400;
		`,
		more: css`
			color: ${isDarkMode
				? token.magicColorUsages.white
				: token.magicColorUsages.link.default};
			font-weight: 400;
			font-size: 14px;
			cursor: pointer;
		`,
		spin: css`
			justify-content: flex-start;
			margin-top: 20px;
		`,
	}
})

interface PromptSectionProps extends PromptSection {
	loading?: boolean
	more: boolean
	onCardClick?: (id: string) => void
}

function PropmtSection({
	title,
	desc,
	cards,
	tabs,
	more = false,
	loading = false,
	onCardClick,
}: PromptSectionProps) {
	const { styles } = useStyles()

	const { t } = useTranslation("interface")

	const size = useSize(document.body)

	const colSpan = useMemo(() => {
		if (size?.width) {
			if (size.width < 400) {
				return 24
			}
			return 12
		}

		return 12
	}, [size?.width])

	const titleRender = useMemo(() => {
		return desc ? (
			<div>
				<div>{title}</div>
				<div className={styles.desc}>{desc}</div>
			</div>
		) : (
			<div>{title}</div>
		)
	}, [desc, styles.desc, title])

	return (
		<Card
			title={titleRender}
			bordered={false}
			extra={
				more && (
					<div className={styles.more} onClick={() => {}}>
						{t("explore.buttonText.moreAll")}
					</div>
				)
			}
			className={styles.container}
			classNames={{ header: styles.header, body: styles.body }}
			tabList={tabs}
		>
			<MagicSpin section spinning={loading} className={styles.spin}>
				{cards.length === 0 && !loading ? <MagicEmpty className={styles.empty} /> : null}
				<Row gutter={[colSpan, 14]} className={styles.body} align="middle">
					{cards.map((item) => {
						const key = item.id
						return (
							<Col span={colSpan} key={key}>
								<PromptCard
									onClick={onCardClick}
									data={{
										id: item.id,
										title: item.robot_name,
										icon: item.robot_avatar,
										description: item.robot_description,
									}}
									textGap4
								/>
							</Col>
						)
					})}
				</Row>
			</MagicSpin>
		</Card>
	)
}

export default PropmtSection
