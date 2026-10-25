import type { CSSProperties } from "react"
import { cx } from "antd-style"
import RichText from "@/pages/superMagic/components/MessageList/components/Text/components/RichText"
import SmartTooltip from "@/components/other/SmartTooltip"
import { useStyles } from "./styles"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"

export interface CollapsibleTextProps {
	content: JSONContent | string
	maxLines?: number
	className?: string
	onFileClick?: (fileId: string, data: unknown) => void
}

function CollapsibleText({ content, maxLines = 2, className, onFileClick }: CollapsibleTextProps) {
	const { styles } = useStyles()
	const tooltipTitle = (
		<div className={styles.tooltipContent}>
			<RichText content={content} onFileClick={onFileClick} />
		</div>
	)

	return (
		<SmartTooltip content={tooltipTitle} maxLines={0} className="w-full">
			<div
				className={cx(styles.container, styles.textContainer, styles.collapsed, className)}
				// 折叠行数下发到样式：折叠高度由浏览器按真实行盒裁剪得出，
				// 组件不再持有像素行高，含高内联节点的行也不会被裁掉边框。
				style={{ "--collapsible-lines": String(maxLines) } as CSSProperties}
				data-testid="collapsible-text"
				data-collapsed-lines={maxLines}
			>
				<RichText content={content} onFileClick={onFileClick} />
			</div>
		</SmartTooltip>
	)
}

export default CollapsibleText
