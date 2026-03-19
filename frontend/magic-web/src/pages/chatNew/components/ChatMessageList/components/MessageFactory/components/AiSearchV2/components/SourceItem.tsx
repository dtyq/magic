import { formatTime } from "@/utils/string"
import { createStyles } from "antd-style"

import { useTranslation } from "react-i18next"
import { A } from "../../Markdown/EnhanceMarkdown/components/A"

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		a: css`
			color: ${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.text[1]};
		`,
		date: css`
			color: ${token.colorTextQuaternary};
			font-size: 12px;
			font-weight: 400;
			line-height: 20px;
		`,
	}
})

interface SourceItemProps {
	name: string
	url: string
	datePublished: number | string
}

function SourceItem({ name, url, datePublished }: SourceItemProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("common")
	return (
		<>
			<A href={url} className={styles.a}>
				{name}
			</A>
			<span className={styles.date}>
				{datePublished
					? ` [${formatTime(datePublished, t("format.yearMounthAndDay"))}]`
					: null}
			</span>
		</>
	)
}

export default SourceItem
