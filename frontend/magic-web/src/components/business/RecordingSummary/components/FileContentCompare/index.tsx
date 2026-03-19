import { memo, useMemo, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "antd"
import type { MenuProps } from "antd"
import { IconCheck, IconSparkles } from "@tabler/icons-react"
import FlexBox from "@/components/base/FlexBox"
import {
	resolveMergeConflicts,
	resolveConflictsWithSelections,
	resolveChangesWithSelections,
	type ConflictInfo,
	type ChangeInfo,
} from "./utils/diff"
import { useStyles } from "./styles"
import { DiffContentColumn, MergePreviewColumn } from "./components"
import {
	useDiffCompute,
	useConflictResolution,
	useChangeResolution,
	useScrollSync,
	useAIResolution,
} from "./hooks"
import type { FileContentCompareProps } from "./types"
import { ConflictResolution } from "./types"

/**
 * 文件内容对比组件
 * 提供当前版本、服务器版本和合并预览三列对比视图
 * 支持冲突的智能合并和手动解决
 */
function FileContentCompare({
	currentContent,
	serverContent,
	selectedType,
	currentLabel,
	serverLabel,
	mergeLabel,
	onMergeChange,
	onResolvedMergeChange,
	onSelectionChange,
	showFooter = false,
	onUseCurrent,
	onUseServer,
	onUseMerge,
	loading = false,
}: FileContentCompareProps) {
	const { t } = useTranslation("super")

	// 计算 diff 和合并内容
	const { diff, mergedContent, conflicts, changes } = useDiffCompute(
		currentContent,
		serverContent,
	)

	// 冲突解决状态管理
	const {
		conflictSelections,
		conflictCustomContents,
		hasUnresolvedConflicts,
		handleConflictSelect,
		handleConflictCustom,
		handleEditConflict,
		handleSaveConflictEdit,
		handleUseAllCurrent: handleConflictUseAllCurrent,
		handleUseAllServer: handleConflictUseAllServer,
		handleApplyRecommendations: handleConflictApplyRecommendations,
		handleResetAll: handleConflictResetAll,
	} = useConflictResolution(conflicts)

	// 变更解决状态管理
	const {
		changeSelections,
		hasUnresolvedChanges,
		handleChangeSelect,
		handleUseAllCurrent: handleChangeUseAllCurrent,
		handleUseAllServer: handleChangeUseAllServer,
		handleApplyRecommendations: handleChangeApplyRecommendations,
		handleResetAllChanges: handleChangeResetAll,
	} = useChangeResolution(changes)

	// 滚动同步
	const { registerScroller, handleScroll } = useScrollSync()

	// AI 智能合并
	const { aiLoading, aiRecommendations } = useAIResolution({
		conflicts,
		changes,
		onConflictSelect: handleConflictSelect,
		onConflictCustom: handleConflictCustom,
		onChangeSelect: handleChangeSelect,
	})

	// 合并 AI 推荐到冲突和变更对象中
	const conflictsWithAI: ConflictInfo[] = useMemo(() => {
		return conflicts.map((conflict) => {
			const aiRec = aiRecommendations.conflicts.get(conflict.id)
			if (aiRec) {
				// Map AI resolution to ConflictRecommendation type
				const recommendation: ConflictResolution =
					aiRec.resolution === ConflictResolution.CUSTOM
						? ConflictResolution.CUSTOM
						: aiRec.resolution
				return {
					...conflict,
					recommendation,
					recommendationReason: aiRec.reason,
					recommendationSource: "ai", // Mark as AI recommendation
				}
			}
			return conflict
		})
	}, [conflicts, aiRecommendations.conflicts])

	const changesWithAI: ChangeInfo[] = useMemo(() => {
		return changes.map((change) => {
			const aiRec = aiRecommendations.changes.get(change.id)
			if (aiRec) {
				return {
					...change,
					recommendation: aiRec.resolution,
					recommendationReason: aiRec.reason,
					recommendationSource: "ai", // Mark as AI recommendation
				}
			}
			return change
		})
	}, [changes, aiRecommendations.changes])

	// 批量操作：全部使用当前版本（同时处理冲突和变更）
	const handleUseAllCurrent = useCallback(() => {
		handleConflictUseAllCurrent()
		handleChangeUseAllCurrent()
	}, [handleConflictUseAllCurrent, handleChangeUseAllCurrent])

	// 批量操作：全部使用服务器版本（同时处理冲突和变更）
	const handleUseAllServer = useCallback(() => {
		handleConflictUseAllServer()
		handleChangeUseAllServer()
	}, [handleConflictUseAllServer, handleChangeUseAllServer])

	// 批量操作：应用所有智能合并（同时处理冲突和变更）
	const handleApplyRecommendations = useCallback(() => {
		handleConflictApplyRecommendations()
		handleChangeApplyRecommendations()
	}, [handleConflictApplyRecommendations, handleChangeApplyRecommendations])

	// 批量操作：重置所有选择（同时处理冲突和变更）
	const handleResetAll = useCallback(() => {
		handleConflictResetAll()
		handleChangeResetAll()
	}, [handleConflictResetAll, handleChangeResetAll])

	// 计算已解决的合并内容
	const resolvedContent = useMemo(() => {
		let content = mergedContent

		// Step 1: 解决冲突
		if (conflictSelections.size > 0) {
			content = resolveConflictsWithSelections(
				content,
				conflictSelections,
				conflictCustomContents,
			)
		} else {
			content = resolveMergeConflicts(content)
		}

		// Step 2: 解决变更（新增/删除）
		content = resolveChangesWithSelections(content, changeSelections)

		return content
	}, [mergedContent, conflictSelections, conflictCustomContents, changeSelections])

	// 通知父组件合并结果（预览用）
	useEffect(() => {
		onMergeChange?.(mergedContent)
	}, [mergedContent, onMergeChange])

	// 通知父组件已解决的合并结果（实际使用）
	useEffect(() => {
		onResolvedMergeChange?.(resolvedContent)
	}, [resolvedContent, onResolvedMergeChange])

	// 标签文本（使用提供的标签或 i18n 默认值）
	const currentLabelText = currentLabel || t("recordingSummary.fileChangeModal.currentLabel")
	const serverLabelText = serverLabel || t("recordingSummary.fileChangeModal.serverLabel")
	const mergeLabelText = mergeLabel || t("recordingSummary.fileChangeModal.mergeLabel")
	const emptyText = t("recordingSummary.fileChangeModal.empty")

	// 处理列点击
	const handleColumnClick = (type: "current" | "server" | "merge") => {
		onSelectionChange?.(type)
	}

	// 处理确认按钮点击
	const handleConfirm = useCallback(async () => {
		if (!selectedType || loading) {
			return
		}

		// 如果选择了合并但还有未解决的冲突或变更，阻止确认
		if (selectedType === "merge" && (hasUnresolvedConflicts || hasUnresolvedChanges)) {
			return
		}

		if (selectedType === "current") {
			onUseCurrent?.()
		} else if (selectedType === "server") {
			onUseServer?.()
		} else if (selectedType === "merge") {
			onUseMerge?.(resolvedContent)
		}
	}, [
		selectedType,
		loading,
		hasUnresolvedConflicts,
		hasUnresolvedChanges,
		onUseCurrent,
		onUseServer,
		onUseMerge,
		resolvedContent,
	])

	// 检查确认按钮是否应该禁用
	const isConfirmDisabled = useMemo(() => {
		if (!selectedType || loading) {
			return true
		}
		// 如果选择了合并但还有未解决的冲突或变更，禁用按钮
		if (selectedType === "merge" && (hasUnresolvedConflicts || hasUnresolvedChanges)) {
			return true
		}
		return false
	}, [selectedType, loading, hasUnresolvedConflicts, hasUnresolvedChanges])

	// 确认按钮文本
	const confirmButtonText = useMemo(() => {
		if (selectedType === "merge") {
			const unresolvedConflictsCount = hasUnresolvedConflicts
				? conflicts.length - conflictSelections.size
				: 0
			const unresolvedChangesCount = hasUnresolvedChanges
				? changes.length - changeSelections.size
				: 0

			if (unresolvedConflictsCount > 0 || unresolvedChangesCount > 0) {
				return t("recordingSummary.fileChangeModal.remainingConflicts", {
					count: unresolvedConflictsCount + unresolvedChangesCount,
				})
			}
		}
		return t("recordingSummary.fileChangeModal.confirm")
	}, [
		selectedType,
		hasUnresolvedConflicts,
		hasUnresolvedChanges,
		conflicts.length,
		changes.length,
		conflictSelections.size,
		changeSelections.size,
		t,
	])

	// 批量操作菜单项
	const batchMenuItems: MenuProps["items"] = useMemo(
		() => [
			{
				key: "all-current",
				label: t("recordingSummary.fileChangeModal.useAllCurrent"),
				onClick: handleUseAllCurrent,
			},
			{
				key: "all-server",
				label: t("recordingSummary.fileChangeModal.useAllServer"),
				onClick: handleUseAllServer,
			},
			{
				key: "recommendations",
				label: t("recordingSummary.fileChangeModal.applyRecommendations"),
				icon: <IconSparkles size={14} />,
				onClick: handleApplyRecommendations,
			},
			{
				type: "divider",
			},
			{
				key: "reset",
				label: t("recordingSummary.fileChangeModal.resetAll"),
				onClick: handleResetAll,
				danger: true,
			},
		],
		[t, handleUseAllCurrent, handleUseAllServer, handleApplyRecommendations, handleResetAll],
	)

	const { styles } = useStyles()

	const selectedText = (
		<FlexBox align="center" gap={4}>
			<IconCheck size={14} /> {t("recordingSummary.fileChangeModal.selected")}
		</FlexBox>
	)

	// Calculate column flex ratios based on selection
	const isMergeSelected = selectedType === "merge"
	const columnFlexRatios = {
		current: isMergeSelected ? 2 : 1,
		server: isMergeSelected ? 2 : 1,
		merge: isMergeSelected ? 6 : 1,
	}

	return (
		<>
			<div className={styles.container}>
				{/* 当前内容列 */}
				{selectedType === "current" && (
					<DiffContentColumn
						diff={diff}
						side="current"
						label={currentLabelText}
						selectedText={selectedText}
						emptyText={emptyText}
						style={{ flex: columnFlexRatios.current }}
						scrollContainerRef={(el) => registerScroller("current", el)}
						onScroll={() => handleScroll("current")}
					/>
				)}

				{/* 服务器内容列 */}
				{selectedType === "server" && (
					<DiffContentColumn
						diff={diff}
						side="server"
						label={serverLabelText}
						selectedText={selectedText}
						emptyText={emptyText}
						style={{ flex: columnFlexRatios.server }}
						scrollContainerRef={(el) => registerScroller("server", el)}
						onScroll={() => handleScroll("server")}
					/>
				)}

				{/* 合并预览列 */}
				{selectedType === "merge" && (
					<MergePreviewColumn
						mergedContent={mergedContent}
						conflicts={conflictsWithAI}
						changes={changesWithAI}
						conflictSelections={conflictSelections}
						conflictCustomContents={conflictCustomContents}
						changeSelections={changeSelections}
						label={mergeLabelText}
						emptyText={emptyText}
						onConflictSelect={handleConflictSelect}
						onConflictEdit={handleEditConflict}
						onConflictSaveEdit={handleSaveConflictEdit}
						onChangeSelect={handleChangeSelect}
						batchMenuItems={batchMenuItems}
						// onAIResolve={handleAIResolve}
						aiLoading={aiLoading}
						style={{ flex: columnFlexRatios.merge }}
						scrollContainerRef={(el) => registerScroller("merge", el)}
						onScroll={() => handleScroll("merge")}
					/>
				)}
			</div>

			{/* 底部操作区 */}
			{showFooter && (
				<FlexBox justify="flex-end" gap={12}>
					<Button
						type="primary"
						onClick={handleConfirm}
						disabled={isConfirmDisabled}
						loading={loading}
					>
						{confirmButtonText}
					</Button>
				</FlexBox>
			)}
		</>
	)
}

export default memo(FileContentCompare)
export type { SelectedContentType, FileContentCompareProps } from "./types"
