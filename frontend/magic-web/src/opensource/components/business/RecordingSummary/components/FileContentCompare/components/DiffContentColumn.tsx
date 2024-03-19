import { memo } from "react"
import { DiffOp, type DiffResult } from "../utils/diff"
import { renderInlineFragments } from "../renderUtils"
import { useStyles } from "../styles"

interface DiffContentColumnProps {
	/** 差异结果 */
	diff: DiffResult[]
	/** 显示哪一侧的内容：current 或 server */
	side: "current" | "server"
	/** 列标题 */
	label: string
	/** 选中标识文本 */
	selectedText: React.ReactNode
	/** 空内容提示文本 */
	emptyText: string
	/** 自定义样式 */
	style?: React.CSSProperties
	/** 滚动容器 ref 回调 */
	scrollContainerRef?: (el: HTMLElement | null) => void
	/** 滚动事件回调 */
	onScroll?: () => void
}

/**
 * Diff 内容列组件
 * 显示当前版本或服务器版本的差异内容
 */
function DiffContentColumn({
	diff,
	side,
	label,
	selectedText,
	emptyText,
	style,
	scrollContainerRef,
	onScroll,
}: DiffContentColumnProps) {
	const { styles, cx } = useStyles()

	// 渲染 diff 内容
	const renderDiffContent = () => {
		if (diff.length === 0) {
			return <div className={styles.empty}>{emptyText}</div>
		}

		const lines: JSX.Element[] = []
		let lineNum = 1

		for (const part of diff) {
			if (part.operation === DiffOp.EQUAL) {
				// 未改变的行
				lines.push(
					<div key={`eq-${lineNum}`} className={styles.codeLineWithNumber}>
						<div className={styles.inlineLineNumber} data-line-number={lineNum}>
							{lineNum}
						</div>
						<div className={`${styles.unchanged} ${styles.inlineCodeContent}`}>
							{part.text || " "}
						</div>
					</div>,
				)
				lineNum++
			} else if (part.operation === DiffOp.DELETE) {
				// 删除的行（只在当前版本显示）
				if (side === "current") {
					// 如果有内联 diff，渲染片段而不是整行
					if (part.inlineDiff && part.inlineDiff.length > 0) {
						const fragments = renderInlineFragments(
							part.inlineDiff,
							"current",
							lineNum,
							styles,
						)
						if (fragments.length > 0) {
							lines.push(
								<div key={`del-${lineNum}`} className={styles.codeLineWithNumber}>
									<div
										className={styles.inlineLineNumber}
										data-line-number={lineNum}
									>
										{lineNum}
									</div>
									<div
										className={`${styles.diffLine} ${styles.inlineCodeContent}`}
									>
										{fragments}
									</div>
								</div>,
							)
						} else {
							// 回退到整行显示
							lines.push(
								<div key={`del-${lineNum}`} className={styles.codeLineWithNumber}>
									<div
										className={styles.inlineLineNumber}
										data-line-number={lineNum}
									>
										{lineNum}
									</div>
									<div
										className={`${styles.diffLine} ${styles.deleted} ${styles.inlineCodeContent}`}
									>
										{part.text}
									</div>
								</div>,
							)
						}
					} else {
						lines.push(
							<div key={`del-${lineNum}`} className={styles.codeLineWithNumber}>
								<div className={styles.inlineLineNumber} data-line-number={lineNum}>
									{lineNum}
								</div>
								<div
									className={`${styles.diffLine} ${styles.deleted} ${styles.inlineCodeContent}`}
								>
									{part.text}
								</div>
							</div>,
						)
					}
					lineNum++
				}
			} else if (part.operation === DiffOp.INSERT) {
				// 新增的行（只在服务器版本显示）
				if (side === "server") {
					// 如果有内联 diff，渲染片段而不是整行
					if (part.inlineDiff && part.inlineDiff.length > 0) {
						const fragments = renderInlineFragments(
							part.inlineDiff,
							"server",
							lineNum,
							styles,
						)
						if (fragments.length > 0) {
							lines.push(
								<div key={`ins-${lineNum}`} className={styles.codeLineWithNumber}>
									<div
										className={styles.inlineLineNumber}
										data-line-number={lineNum}
									>
										{lineNum}
									</div>
									<div
										className={`${styles.diffLine} ${styles.inlineCodeContent}`}
									>
										{fragments}
									</div>
								</div>,
							)
						} else {
							// 回退到整行显示
							lines.push(
								<div key={`ins-${lineNum}`} className={styles.codeLineWithNumber}>
									<div
										className={styles.inlineLineNumber}
										data-line-number={lineNum}
									>
										{lineNum}
									</div>
									<div
										className={`${styles.diffLine} ${styles.added} ${styles.inlineCodeContent}`}
									>
										{part.text}
									</div>
								</div>,
							)
						}
					} else {
						lines.push(
							<div key={`ins-${lineNum}`} className={styles.codeLineWithNumber}>
								<div className={styles.inlineLineNumber} data-line-number={lineNum}>
									{lineNum}
								</div>
								<div
									className={`${styles.diffLine} ${styles.added} ${styles.inlineCodeContent}`}
								>
									{part.text}
								</div>
							</div>,
						)
					}
					lineNum++
				}
			}
		}

		if (lines.length === 0) {
			return <div className={styles.empty}>{emptyText}</div>
		}

		return <div className={styles.codeContent}>{lines}</div>
	}

	return (
		<div className={cx(styles.column)} style={style}>
			<div className={styles.content} ref={scrollContainerRef} onScroll={onScroll}>
				{renderDiffContent()}
			</div>
		</div>
	)
}

export default memo(DiffContentColumn)
