import { Tag } from "antd"

import { useMemo } from "react"
import { createStyles, cx } from "antd-style"

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		tag: css`
			margin-right: 0;
			display: flex;
			align-items: center;
			gap: 2px;
			border: none;
			background-color: ${isDarkMode
				? token.magicColorUsages.fill[2]
				: token.magicColorUsages.fill[0]};
			color: ${isDarkMode ? token.magicColorUsages.text[3] : token.magicColorUsages.text[2]};
		`,
		green: css`
			background-color: ${isDarkMode
				? token.magicColorScales.green[0]
				: token.magicColorScales.green[0]};
			color: ${isDarkMode
				? token.magicColorScales.green[5]
				: token.magicColorScales.green[5]};
		`,
		orange: css`
			background-color: ${isDarkMode
				? token.magicColorUsages.fill[2]
				: token.magicColorUsages.fill[0]};
		`,
		blue: css`
			background-color: ${isDarkMode
				? token.magicColorScales.brand[8]
				: token.magicColorScales.brand[0]};
		`,
	}
})

type FlowTagProps = {
	text: string
	icon: React.ReactNode
	color?: string
}

export default function FlowTag({ text, icon, color }: FlowTagProps) {
	const { styles } = useStyles()

	const selectedColor = useMemo(() => {
		const colorMap: { [key: string]: string } = {
			blue: styles.blue,
			green: styles.green,
			orange: styles.orange,
		}
		return color && colorMap[color]
	}, [color, styles.blue, styles.green, styles.orange])

	return (
		<Tag icon={icon} className={cx(styles.tag, selectedColor)}>
			{text}
		</Tag>
	)
}
