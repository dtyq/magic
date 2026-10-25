import type { CSSProperties } from "react"
import { useMagicSearchStore } from "../store"

interface HighlightTextProps {
	text?: string
	style?: CSSProperties
}

const HighlightText = ({ text, style }: HighlightTextProps) => {
	const keyword = useMagicSearchStore((store) => store.searchWord)

	if (!keyword) return <span>{text}</span>

	const parts = text?.split(new RegExp(`(${keyword})`, "gi"))
	return parts?.map((part, index) => {
		const isChecked = part.toLowerCase() === keyword.toLowerCase()
		const key = `${index}_${part}`
		return isChecked ? (
			<span key={key} className="font-bold text-primary">
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
