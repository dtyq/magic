import { Fragment, type ReactNode } from "react"
import { cn } from "../../lib/utils"
import styles from "./MediaResultActionBar.module.css"

export interface MediaResultActionBarProps {
	/** 按显示顺序传入动作按钮，空值会被自动过滤 */
	actions: Array<ReactNode | null | false | undefined>
	/** 相邻动作之间显示竖分割线 */
	showDividers?: boolean
	/** 指定哪些 action 索引前显示分割线（基于过滤空值后的索引） */
	dividerBeforeIndices?: number[]
	className?: string
}

/**
 * 画布媒体结果态底部操作条：统一「快捷编辑 / 重新编辑 / 再次生成」等布局。
 */
export function MediaResultActionBar(props: MediaResultActionBarProps) {
	const { actions, showDividers, dividerBeforeIndices, className } = props
	const visibleActions = actions.filter(Boolean)
	const shouldShowDividerBefore = (index: number) => {
		if (index <= 0 || !showDividers) return false
		if (!dividerBeforeIndices?.length) return true
		return dividerBeforeIndices.includes(index)
	}

	return (
		<div className={cn(styles.root, className)} role="group">
			{visibleActions.map((action, index) => (
				<Fragment key={index}>
					{shouldShowDividerBefore(index) ? (
						<div className={styles.divider} aria-hidden />
					) : null}
					<div className={styles.item}>
						<div className={styles.itemContent}>{action}</div>
					</div>
				</Fragment>
			))}
		</div>
	)
}
