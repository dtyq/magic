import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	computeDiff,
	interactiveMerge,
	parseConflicts,
	parseChanges,
	getConflictRecommendation,
} from "../utils/diff"

/**
 * Diff 计算 Hook
 * 计算差异、合并内容和冲突信息
 */
export function useDiffCompute(currentContent: string, serverContent: string) {
	const { t } = useTranslation("super")

	// 计算 diff（行级别差异）
	const diff = useMemo(() => {
		return computeDiff(currentContent, serverContent)
	}, [currentContent, serverContent])

	// 计算合并内容（包含冲突标记和变更标记）
	const mergedContent = useMemo(() => {
		return interactiveMerge(currentContent, serverContent, {
			currentVersion: t("recordingSummary.fileChangeModal.currentVersion"),
			serverVersion: t("recordingSummary.fileChangeModal.serverVersion"),
		})
	}, [currentContent, serverContent, t])

	// 解析冲突并添加推荐和行号信息
	const conflicts = useMemo(() => {
		const parsedConflicts = parseConflicts(mergedContent)

		// 分割内容为行数组，用于计算行号
		const currentLines = currentContent.split("\n")
		const serverLines = serverContent.split("\n")

		// 为每个冲突添加推荐和行号
		return parsedConflicts.map((conflict) => {
			// 获取智能合并
			const { recommendation, reason } = getConflictRecommendation(conflict, {
				moreContent: t("recordingSummary.fileChangeModal.recommendationReason.moreContent"),
				onlyAdditions: t(
					"recordingSummary.fileChangeModal.recommendationReason.onlyAdditions",
				),
				onlyDeletions: t(
					"recordingSummary.fileChangeModal.recommendationReason.onlyDeletions",
				),
				smallChanges: t(
					"recordingSummary.fileChangeModal.recommendationReason.smallChanges",
				),
				serverExtends: t(
					"recordingSummary.fileChangeModal.recommendationReason.serverExtends",
				),
				currentExtends: t(
					"recordingSummary.fileChangeModal.recommendationReason.currentExtends",
				),
			})

			// 计算冲突行在原始文件中的行号
			const currentLineNumbers: number[] = []
			const serverLineNumbers: number[] = []

			// 在当前内容中查找匹配的行号
			for (const line of conflict.currentLines) {
				const lineIndex = currentLines.findIndex(
					(l, idx) => l === line && !currentLineNumbers.includes(idx + 1),
				)
				currentLineNumbers.push(lineIndex >= 0 ? lineIndex + 1 : 0)
			}

			// 在服务器内容中查找匹配的行号
			for (const line of conflict.serverLines) {
				const lineIndex = serverLines.findIndex(
					(l, idx) => l === line && !serverLineNumbers.includes(idx + 1),
				)
				serverLineNumbers.push(lineIndex >= 0 ? lineIndex + 1 : 0)
			}

			return {
				...conflict,
				recommendation,
				recommendationReason: reason,
				currentLineNumbers,
				serverLineNumbers,
			}
		})
	}, [mergedContent, currentContent, serverContent, t])

	// 解析变更（纯新增和纯删除）
	const changes = useMemo(() => {
		return parseChanges(mergedContent, currentContent, serverContent, {
			newContent: t("recordingSummary.fileChangeModal.changeRecommendationReason.newContent"),
			deletedContent: t(
				"recordingSummary.fileChangeModal.changeRecommendationReason.deletedContent",
			),
		})
	}, [mergedContent, currentContent, serverContent, t])

	return {
		diff,
		mergedContent,
		conflicts,
		changes,
	}
}
