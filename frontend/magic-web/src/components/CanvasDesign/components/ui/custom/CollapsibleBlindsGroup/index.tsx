import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import styles from "./index.module.css"

/** 单行高度与间距，与 max-height 动画计算一致 */
export const COLLAPSIBLE_BLINDS_ROW_HEIGHT = 28
export const COLLAPSIBLE_BLINDS_ROW_GAP = 2

export function collapsibleBlindsContentMaxHeight(itemCount: number): number {
	if (itemCount <= 0) return 0
	return itemCount * COLLAPSIBLE_BLINDS_ROW_HEIGHT + (itemCount - 1) * COLLAPSIBLE_BLINDS_ROW_GAP
}

export interface CollapsibleBlindsGroupProps {
	title: ReactNode
	expanded: boolean
	onToggle: () => void
	itemCount: number
	children: ReactNode
}

export function CollapsibleBlindsGroup(props: CollapsibleBlindsGroupProps) {
	const { title, expanded, onToggle, itemCount, children } = props
	const maxHeight = collapsibleBlindsContentMaxHeight(itemCount)

	return (
		<div className={styles.group}>
			<div className={styles.titleRow} onClick={onToggle} role="button" tabIndex={0}>
				<ChevronRight
					size={14}
					className={`${styles.chevron} ${expanded ? styles.chevronExpanded : ""}`}
					aria-hidden
				/>
				<span className={styles.titleText}>{title}</span>
			</div>
			<div
				className={`${styles.content} ${expanded ? styles.contentExpanded : ""}`}
				style={expanded ? { maxHeight } : undefined}
			>
				{children}
			</div>
		</div>
	)
}

export interface CollapsibleBlindsItemProps {
	onClick?: () => void
	left: ReactNode
	right?: ReactNode
}

export function CollapsibleBlindsItem(props: CollapsibleBlindsItemProps) {
	const { onClick, left, right } = props
	return (
		<div className={styles.item} onClick={onClick}>
			<div className={styles.itemLeft}>{left}</div>
			{right != null ? <span className={styles.itemValue}>{right}</span> : null}
		</div>
	)
}
