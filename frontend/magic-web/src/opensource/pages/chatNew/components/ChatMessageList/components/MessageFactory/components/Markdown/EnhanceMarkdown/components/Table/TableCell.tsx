import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useTableStyles } from "./styles"
import { useTableI18n } from "./useTableI18n"

// 超长文本字符阈值
const LONG_TEXT_THRESHOLD = 50

// 判断文本是否超长
const isLongText = (text: string): boolean => {
	if (!text) return false
	// 如果文本长度超过阈值，则视为超长文本
	return text.length > LONG_TEXT_THRESHOLD
}

// 超长文本包装器组件
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

// 处理表格单元格内容
const processTableCellContent = (children: React.ReactNode): React.ReactNode => {
	// 如果子元素是字符串，检查是否为超长文本
	if (typeof children === "string") {
		if (isLongText(children)) {
			return <LongTextWrapper text={children} />
		}
		return children
	}

	// 如果是React元素数组，递归处理每个元素
	if (Array.isArray(children)) {
		return children.map((child, idx) => {
			if (typeof child === "string" && isLongText(child)) {
				const key = `long-text-${idx}`
				return <LongTextWrapper key={key} text={child} />
			}
			return child
		})
	}

	// 其他情况直接返回
	return children
}

// 判断是否包含特殊符号
const hasSpecialSymbols = (text: string): boolean => {
	// 检查常见的特殊符号
	const specialSymbols = ["→", "↓", "←", "↑", "≤", "≥", "≠", "≈", "∞", "∑", "∫", "∏"]
	return specialSymbols.some((symbol) => text.includes(symbol))
}

// 判断文本对齐方式
const getTextAlignment = (text: string | React.ReactNode): string => {
	if (typeof text !== "string") return "left"

	// 清理文本内容
	const cleanText = text.trim()

	// 特殊符号通常居中显示
	if (
		hasSpecialSymbols(cleanText) ||
		cleanText === "→↓←" ||
		cleanText === "↓↓" ||
		cleanText === "↓"
	) {
		return "center"
	}

	// 左对齐标识
	if (
		cleanText.startsWith(":左对齐<<") ||
		cleanText.startsWith("<<") ||
		cleanText === ":左对齐" ||
		cleanText === ":对齐<<"
	) {
		return "left"
	}

	// 居中对齐标识
	if (
		cleanText.startsWith(">>居中<<") ||
		(cleanText.startsWith(">>") && cleanText.endsWith("<<")) ||
		cleanText === ">>" ||
		cleanText === ">>居中<<"
	) {
		return "center"
	}

	// 右对齐标识
	if (
		cleanText.startsWith(">>右对齐:") ||
		cleanText.endsWith(">>") ||
		cleanText.includes("%") ||
		cleanText.includes("：") ||
		cleanText === ">>右对齐:"
	) {
		return "right"
	}

	// 纯数字或以数字结尾通常右对齐
	if (/^\d+$/.test(cleanText) || cleanText.endsWith("%") || /\d+$/.test(cleanText)) {
		return "right"
	}

	// 默认左对齐
	return "left"
}

// 表格单元格组件
const TableCell: React.FC<{
	isHeader?: boolean
	children?: React.ReactNode
}> = ({ isHeader = false, children, ...props }) => {
	const processedContent = processTableCellContent(children)
	const textAlign = getTextAlignment(children)

	const style = {
		textAlign: textAlign as "left" | "center" | "right",
		// 添加保留空格和特殊字符的样式
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
