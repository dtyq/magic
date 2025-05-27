import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useTableStyles } from "./styles"
import { useTableI18n } from "./useTableI18n"

// Long text character threshold
const LONG_TEXT_THRESHOLD = 50

// Check if text is too long
const isLongText = (text: string): boolean => {
	if (!text) return false
	// If text length exceeds threshold, consider it as long text
	return text.length > LONG_TEXT_THRESHOLD
}

// Long text wrapper component
const LongTextWrapper: React.FC<{ text: string }> = ({ text }) => {
	const i18n = useTableI18n()
	const { styles, cx } = useTableStyles()
	const [expanded, setExpanded] = useState(false)
	const textRef = useRef<HTMLDivElement>(null)

	const toggleExpand = () => {
		setExpanded(!expanded)
	}

	return (
		<div
			ref={textRef}
			className={cx(styles.longText, { expanded })}
			onClick={toggleExpand}
			title={expanded ? "" : i18n.clickToExpand}
		>
			{text}
		</div>
	)
}

// Process table cell content
const processTableCellContent = (children: React.ReactNode): React.ReactNode => {
	// If child element is string, check if it's long text
	if (typeof children === "string") {
		if (isLongText(children)) {
			return <LongTextWrapper text={children} />
		}
		return children
	}

	// If it's an array of React elements, process each element recursively
	if (Array.isArray(children)) {
		return children.map((child, idx) => {
			if (typeof child === "string" && isLongText(child)) {
				const key = `long-text-${idx}`
				return <LongTextWrapper key={key} text={child} />
			}
			return child
		})
	}

	// Return directly for other cases
	return children
}

// Check if contains special symbols
const hasSpecialSymbols = (text: string): boolean => {
	// Check common special symbols
	const specialSymbols = ["→", "↓", "←", "↑", "≤", "≥", "≠", "≈", "∞", "∑", "∫", "∏"]
	return specialSymbols.some((symbol) => text.includes(symbol))
}

// Determine text alignment
const getTextAlignment = (text: string | React.ReactNode): string => {
	if (typeof text !== "string") return "left"

	// Clean text content
	const cleanText = text.trim()

	// Special symbols are usually centered
	if (
		hasSpecialSymbols(cleanText) ||
		cleanText === "→↓←" ||
		cleanText === "↓↓" ||
		cleanText === "↓"
	) {
		return "center"
	}

	// Left alignment markers
	if (
		cleanText.startsWith(":左对齐<<") ||
		cleanText.startsWith("<<") ||
		cleanText === ":左对齐" ||
		cleanText === ":对齐<<"
	) {
		return "left"
	}

	// Center alignment markers
	if (
		cleanText.startsWith(">>居中<<") ||
		(cleanText.startsWith(">>") && cleanText.endsWith("<<")) ||
		cleanText === ">>" ||
		cleanText === ">>居中<<"
	) {
		return "center"
	}

	// Right alignment markers
	if (
		cleanText.startsWith(">>右对齐:") ||
		cleanText.endsWith(">>") ||
		cleanText.includes("%") ||
		cleanText.includes("：") ||
		cleanText === ">>右对齐:"
	) {
		return "right"
	}

	// Pure numbers or ending with numbers are usually right-aligned
	if (/^\d+$/.test(cleanText) || cleanText.endsWith("%") || /\d+$/.test(cleanText)) {
		return "right"
	}

	// Default left alignment
	return "left"
}

// Table cell component
const TableCell: React.FC<{
	isHeader?: boolean
	children?: React.ReactNode
}> = ({ isHeader = false, children, ...props }) => {
	const processedContent = processTableCellContent(children)
	const textAlign = getTextAlignment(children)

	const style = {
		textAlign: textAlign as "left" | "center" | "right",
		// Add styles to preserve spaces and special characters
		whiteSpace: "pre-wrap" as const,
	}

	if (isHeader) {
		return (
			<th style={style} {...props}>
				{processedContent}
			</th>
		)
	}

	return (
		<td style={style} {...props}>
			{processedContent}
		</td>
	)
}

export default TableCell
