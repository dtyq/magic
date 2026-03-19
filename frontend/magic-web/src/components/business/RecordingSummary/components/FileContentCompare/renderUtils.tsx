import { DiffOp, type InlineDiffFragment } from "./utils/diff"

/**
 * 渲染工具函数
 */

/**
 * 渲染内联 diff 片段
 */
export function renderInlineFragments(
	fragments: InlineDiffFragment[],
	side: "current" | "server",
	lineNum: number,
	styles: Record<string, string>,
) {
	return fragments
		.filter((fragment) => fragment.text.length > 0) // 过滤空片段
		.map((fragment, idx) => {
			if (side === "current") {
				// 当前侧：显示 DELETE 和 EQUAL 片段
				if (fragment.operation === DiffOp.DELETE) {
					return (
						<span
							key={`inline-del-${lineNum}-${idx}`}
							className={`${styles.inlineFragment} ${styles.inlineDeleted}`}
						>
							{fragment.text}
						</span>
					)
				}
				if (fragment.operation === DiffOp.EQUAL) {
					return (
						<span
							key={`inline-eq-${lineNum}-${idx}`}
							className={`${styles.inlineFragment} ${styles.inlineUnchanged}`}
						>
							{fragment.text}
						</span>
					)
				}
				return null
			} else {
				// 服务器侧：显示 INSERT 和 EQUAL 片段
				if (fragment.operation === DiffOp.INSERT) {
					return (
						<span
							key={`inline-ins-${lineNum}-${idx}`}
							className={`${styles.inlineFragment} ${styles.inlineAdded}`}
						>
							{fragment.text}
						</span>
					)
				}
				if (fragment.operation === DiffOp.EQUAL) {
					return (
						<span
							key={`inline-eq-${lineNum}-${idx}`}
							className={`${styles.inlineFragment} ${styles.inlineUnchanged}`}
						>
							{fragment.text}
						</span>
					)
				}
				return null
			}
		})
		.filter(Boolean) // 移除 null 值
}

/**
 * 渲染行号列表
 */
export function renderLineNumbers(count: number, styles: Record<string, string>) {
	const numbers: JSX.Element[] = []
	for (let i = 1; i <= count; i++) {
		numbers.push(
			<div key={i} className={styles.lineNumberItem} data-line-number={i}>
				{i}
			</div>,
		)
	}
	return <div className={styles.lineNumbers}>{numbers}</div>
}
