import { useState, useRef, useEffect } from "react"
import { cx } from "antd-style"
import { useTranslation } from "react-i18next"
import RichText from "@/opensource/pages/superMagic/components/MessageList/components/Text/components/RichText"
import { useStyles } from "./styles"
import type { JSONContent } from "@tiptap/core"
import SuperTooltip from "@/opensource/pages/superMagic/components/SuperTooltip"

export interface CollapsibleTextProps {
	content: JSONContent | string
	maxLines?: number
	className?: string
	onFileClick?: (fileId: string, data: unknown) => void
}

function CollapsibleText({ content, maxLines = 2, className, onFileClick }: CollapsibleTextProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")
	const [isExpanded, setIsExpanded] = useState(false)
	const [shouldShowToggle, setShouldShowToggle] = useState(false)
	const textRef = useRef<HTMLDivElement>(null)

	// 检测文本是否超过指定行数
	useEffect(() => {
		if (textRef.current) {
			const element = textRef.current
			const computedStyle = window.getComputedStyle(element)
			const lineHeight = parseFloat(computedStyle.lineHeight)
			const maxHeight = lineHeight * maxLines

			// 暂时展开以获取真实高度
			element.style.maxHeight = "none"
			element.style.webkitLineClamp = "none"

			const actualHeight = element.scrollHeight
			setShouldShowToggle(actualHeight > maxHeight)

			// 恢复限制
			if (!isExpanded) {
				element.style.maxHeight = `${maxHeight}px`
				element.style.webkitLineClamp = maxLines.toString()
			}
		}
	}, [content, maxLines, isExpanded])

	const handleToggle = () => {
		setIsExpanded(!isExpanded)
	}

	const tooltipTitle =
		shouldShowToggle && !isExpanded ? t("warningCard.clickToExpandContent") : undefined

	return (
		<SuperTooltip className={cx(styles.container, className)} title={tooltipTitle}>
			<div
				ref={textRef}
				className={cx(
					styles.textContainer,
					!isExpanded && shouldShowToggle && styles.collapsed,
				)}
				style={{
					WebkitLineClamp: !isExpanded && shouldShowToggle ? maxLines : "none",
				}}
				onClick={shouldShowToggle ? handleToggle : undefined}
			>
				<RichText content={content} onFileClick={onFileClick} />
			</div>
		</SuperTooltip>
	)
}

export default CollapsibleText
