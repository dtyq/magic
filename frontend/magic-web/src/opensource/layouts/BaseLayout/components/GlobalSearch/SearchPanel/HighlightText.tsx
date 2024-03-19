import type { CSSProperties } from "react"
import { createStyles } from "antd-style"
import { useMagicSearchStore } from "../store"

interface HighlightTextProps {
	text?: string
	style?: CSSProperties
}

const useStyles = createStyles(({ token }) => {
	return {
		mark: {
			fontWeight: "bold",
			color: token.magicColorScales.brand[5],
		},
	}
})

const HighlightText = ({ text, style }: HighlightTextProps) => {
	const keyword = useMagicSearchStore((store) => store.searchWord)
	const { styles } = useStyles()

	if (!keyword) return <span>{text}</span>

	const parts = text?.split(new RegExp(`(${keyword})`, "gi"))
	return parts?.map((part, index) => {
		const isChecked = part.toLowerCase() === keyword.toLowerCase()
		const key = `${index}_${part}`
		return isChecked ? (
			<span key={key} className={styles.mark}>
				{part}
			</span>
		) : (
			<span key={key} style={style}>
				{part}
			</span>
		)
	})
}

export default HighlightText
