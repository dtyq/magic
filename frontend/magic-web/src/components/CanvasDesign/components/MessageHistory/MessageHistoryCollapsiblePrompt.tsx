import type { ReactNode } from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"
import styles from "./MessageHistoryCollapsiblePrompt.module.css"

export interface MessageHistoryCollapsiblePromptProps {
	/** 原始提示词；仅空白时会展示 emptyLabel */
	text: string
	content?: ReactNode
	emptyLabel: ReactNode
	expandLabel: string
}

/** 生成记录浮层：长提示词默认最多 5 行，超出可展开并在固定高度内滚动 */
export function MessageHistoryCollapsiblePrompt(props: MessageHistoryCollapsiblePromptProps) {
	const { text, content, emptyLabel, expandLabel } = props
	const trimmed = text.trim()
	const textRef = useRef<HTMLDivElement>(null)
	const [expanded, setExpanded] = useState(false)
	const [needsExpand, setNeedsExpand] = useState(false)

	useEffect(() => {
		setExpanded(false)
	}, [trimmed])

	useLayoutEffect(() => {
		const el = textRef.current
		if (!el || expanded) return

		const update = () => {
			setNeedsExpand(el.scrollHeight > el.clientHeight + 1)
		}

		update()
		const ro = new ResizeObserver(update)
		ro.observe(el)
		return () => {
			ro.disconnect()
		}
	}, [trimmed, expanded])

	if (!trimmed) {
		return <div className={styles.root}>{emptyLabel}</div>
	}

	return (
		<div className={styles.root}>
			<div
				ref={textRef}
				className={cn(styles.text, expanded ? styles.expanded : styles.collapsed)}
				data-wheel-trap={expanded ? "hard" : undefined}
			>
				{content ?? trimmed}
			</div>
			{needsExpand && !expanded && (
				<div className={styles.expandButtonWrapper}>
					<span className={styles.expandButtonText}>...</span>
					<Button
						type="button"
						variant="link"
						className={styles.expandButton}
						onClick={() => {
							setExpanded(true)
						}}
					>
						{expandLabel}
					</Button>
				</div>
			)}
		</div>
	)
}
