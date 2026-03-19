import { memo, useRef } from "react"
import type { ConflictInfo, ChangeInfo, ChangeRecommendation } from "../utils/diff"
import ChangeSection from "./ChangeSection"
import ConflictSection from "./ConflictSection"
import { useStyles } from "../styles"
import { ConflictResolution, ConflictResolutionWithoutCustom } from "../types"
import { MenuProps } from "antd"
import { useMemoizedFn } from "ahooks"

interface MergePreviewColumnProps {
	/** 合并后的内容（可能包含冲突标记和变更标记） */
	mergedContent: string
	/** 冲突列表 */
	conflicts: ConflictInfo[]
	/** 变更列表 */
	changes: ChangeInfo[]
	/** 冲突选择状态 */
	conflictSelections: Map<string, ConflictResolution>
	/** 变更选择状态 */
	changeSelections: Map<string, ChangeRecommendation>
	/** 自定义冲突内容 */
	conflictCustomContents: Map<string, string>
	/** 列标题 */
	label: string
	/** 空内容提示文本 */
	emptyText: string
	/** 冲突操作回调 */
	onConflictSelect: (conflictId: string, selection: ConflictResolutionWithoutCustom) => void
	onConflictEdit: (conflict: ConflictInfo) => string
	onConflictSaveEdit: (conflictId: string, content: string) => void
	/** 变更操作回调 */
	onChangeSelect: (changeId: string, selection: ChangeRecommendation) => void
	/** 批量操作菜单项 */
	batchMenuItems: MenuProps["items"]
	/** AI 智能合并回调 */
	onAIResolve?: () => void
	/** AI 加载状态 */
	aiLoading?: boolean
	/** 自定义样式 */
	style?: React.CSSProperties
	/** 滚动容器 ref 回调 */
	scrollContainerRef?: (el: HTMLElement | null) => void
	/** 滚动事件回调 */
	onScroll?: () => void
	/** 暴露滚动到下一个未处理项的方法（通过 ref callback） */
	scrollToNextUnresolvedRef?: (scrollFn: () => void) => void
}

/**
 * 合并预览列组件
 * 显示合并后的内容，包含冲突标记和解决界面
 */
function MergePreviewColumn({
	mergedContent,
	conflicts,
	changes,
	conflictSelections,
	changeSelections,
	conflictCustomContents,
	// label,
	emptyText,
	onConflictSelect,
	onConflictEdit,
	onConflictSaveEdit,
	onChangeSelect,
	// batchMenuItems,
	// onAIResolve,
	// aiLoading = false,
	style,
	onScroll,
}: MergePreviewColumnProps) {
	const { styles, cx } = useStyles()
	const scrollContainerRefInternal = useRef<HTMLDivElement | null>(null)
	const lastScrolledIndexRef = useRef<number>(-1)

	// Scroll to next unresolved conflict or change
	const scrollToNextUnresolved = useMemoizedFn(
		(trigger: { type: "conflict" | "change"; id: string }) => {
			if (!scrollContainerRefInternal.current) return

			const container = scrollContainerRefInternal.current

			const unresolvedItems =
				document.querySelectorAll<HTMLDivElement>(`[data-resolved="false"]`)

			if (unresolvedItems.length === 0) return

			const nextUnresolvedItem = Array.from(unresolvedItems).find(
				(item: HTMLDivElement) =>
					item.dataset.type !== trigger.type || item.dataset.id !== trigger.id,
			)

			if (!nextUnresolvedItem) return

			// Find the DOM element with data-item-index
			const targetElement = container.querySelector(
				`[data-item-index="${Number(nextUnresolvedItem.dataset.itemIndex)}"]`,
			) as HTMLElement
			if (!targetElement) return

			// Scroll into view with smooth behavior
			targetElement.scrollIntoView({
				behavior: "smooth",
				block: "center",
			})

			// Update last scrolled index
			lastScrolledIndexRef.current = Number(nextUnresolvedItem.dataset.itemIndex)

			// Optional: Add visual highlight
			targetElement.style.animation = "highlight-pulse 1s ease-in-out"
			setTimeout(() => {
				targetElement.style.animation = ""
			}, 1000)
		},
	)

	// 渲染合并内容（包含冲突和变更交互）
	const renderMergedContent = () => {
		if (!mergedContent) {
			return <div className={styles.empty}>{emptyText}</div>
		}

		const lines = mergedContent.split("\n")
		const result: JSX.Element[] = []
		let conflictIndex = 0
		let changeIndex = 0
		let lineNumber = 1
		let globalItemIndex = 0 // 全局索引（冲突 + 变更）
		const totalItems = conflicts.length + changes.length // 总数（冲突 + 变更）

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index]
			const currentConflict = conflicts[conflictIndex]
			const currentChange = changes[changeIndex]

			// 检查是否到达冲突标记
			if (currentConflict && index === currentConflict.startIndex) {
				// 获取选择状态和编辑内容
				const selection = conflictSelections.get(currentConflict.id)
				const customContent = conflictCustomContents.get(currentConflict.id)

				globalItemIndex++ // 增加全局索引

				// 渲染冲突区域
				// Check if resolved: has recommendation and selection matches
				const conflictResolved = selection !== undefined
				const conflictResolvedByAI =
					conflictResolved && currentConflict.recommendationSource === "ai"

				result.push(
					<div
						key={`conflict-${currentConflict.id}`}
						data-item-index={globalItemIndex}
						data-type="conflict"
						data-id={currentConflict.id}
						data-resolved={conflictResolved}
					>
						<ConflictSection
							conflict={currentConflict}
							itemNumber={globalItemIndex}
							totalItems={totalItems}
							currentLinesNumbers={currentConflict.currentLineNumbers || []}
							serverLinesNumbers={currentConflict.serverLineNumbers || []}
							selection={selection}
							customContent={customContent || ""}
							resolved={conflictResolved}
							resolvedByAI={conflictResolvedByAI}
							onSelectCurrent={() =>
								onConflictSelect(currentConflict.id, ConflictResolution.CURRENT)
							}
							onSelectServer={() =>
								onConflictSelect(currentConflict.id, ConflictResolution.SERVER)
							}
							onStartEdit={() => onConflictEdit(currentConflict)}
							onSaveEdit={(editContent) =>
								onConflictSaveEdit(currentConflict.id, editContent)
							}
							scrollToNextUnresolved={scrollToNextUnresolved}
						/>
					</div>,
				)

				// 更新行号到冲突之后
				const currentMaxLine = Math.max(...(currentConflict.currentLineNumbers || [0]))
				const serverMaxLine = Math.max(...(currentConflict.serverLineNumbers || [0]))
				lineNumber = Math.max(currentMaxLine, serverMaxLine) + 1

				// 跳到冲突结束位置（包含结束标记）
				index = currentConflict.endIndex
				conflictIndex++
				continue
			}

			// 检查是否是变更标记
			if (line.startsWith("####### ADDITION ") || line.startsWith("####### DELETION ")) {
				if (currentChange && index === currentChange.startIndex) {
					const selection = changeSelections.get(currentChange.id)

					globalItemIndex++ // 增加全局索引

					// Check if resolved: has recommendation and selection matches
					const changeResolved = selection !== undefined
					const changeResolvedByAI =
						changeResolved && currentChange.recommendationSource === "ai"

					// 渲染变更区域
					result.push(
						<div
							key={`change-${currentChange.id}`}
							data-item-index={globalItemIndex}
							data-type="change"
							data-id={currentChange.id}
							data-resolved={changeResolved}
						>
							<ChangeSection
								change={currentChange}
								itemNumber={globalItemIndex}
								totalItems={totalItems}
								selection={selection}
								resolved={changeResolved}
								resolvedByAI={changeResolvedByAI}
								onSelect={onChangeSelect}
								scrollToNextUnresolved={scrollToNextUnresolved}
							/>
						</div>,
					)

					// Skip to end marker (already stored in endIndex)
					index = currentChange.endIndex
					changeIndex++
					continue
				}
			}

			// 检查行是否属于任何冲突或变更
			const isInConflict = conflicts.some(
				(conflict) => index >= conflict.startIndex && index <= conflict.endIndex,
			)

			const isInChange = changes.some(
				(change) => index >= change.startIndex && index <= change.endIndex,
			)

			if (!isInConflict && !isInChange) {
				const displayNumber = lineNumber

				// 普通行（非冲突、非变更行），显示行号
				result.push(
					<div key={`merged-${index}`} className={styles.codeLineWithNumber}>
						<div className={styles.inlineLineNumber} data-line-number={displayNumber}>
							{displayNumber}
						</div>
						<div className={`${styles.unchanged} ${styles.inlineCodeContent}`}>
							{lines[index] || " "}
						</div>
					</div>,
				)
				lineNumber++
			}
		}

		if (result.length === 0) {
			return <div className={styles.empty}>{emptyText}</div>
		}

		return <div className={styles.codeContent}>{result}</div>
	}

	return (
		<div className={cx(styles.column)} style={style}>
			<div
				className={styles.header}
				style={
					{
						...((conflicts.length > 0 || changes.length > 0) && {
							"--progress-width": `${
								((conflictSelections.size + changeSelections.size) /
									(conflicts.length + changes.length)) *
								100
							}%`,
						}),
					} as React.CSSProperties
				}
			/>
			<div className={styles.content} ref={scrollContainerRefInternal} onScroll={onScroll}>
				{renderMergedContent()}
			</div>
		</div>
	)
}

export default memo(MergePreviewColumn)
