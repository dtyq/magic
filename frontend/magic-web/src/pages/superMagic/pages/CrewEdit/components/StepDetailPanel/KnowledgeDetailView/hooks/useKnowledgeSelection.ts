import { useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import type { Knowledge } from "@/types/knowledge"
import { useCrewEditStore } from "../../../../context"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { CREW_EDIT_STEP } from "../../../../store"
import { useKnowledgeDetailMode } from "./useKnowledgeDetailMode"

interface UseKnowledgeSelectionParams {
	knowledgeCode: string
}

interface UseKnowledgeSelectionReturn {
	currentKnowledge: Knowledge.KnowledgeItem | undefined
	showDocumentSplit: boolean
	documentListLength: number
}

/**
 * Hook to manage knowledge selection state and derived values
 * Handles setting selected knowledge on mount/unmount and computes derived UI state
 * Also syncs document selection from URL
 *
 * @param params - Object containing knowledgeCode
 * @returns Object with current knowledge, split visibility flag, and document count
 *
 * @example
 * const { currentKnowledge, showDocumentSplit } = useKnowledgeSelection({
 *   knowledgeCode: 'kb-456'
 * })
 */
export function useKnowledgeSelection({
	knowledgeCode,
}: UseKnowledgeSelectionParams): UseKnowledgeSelectionReturn {
	const { knowledge, crewCode } = useCrewEditStore()
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const { isCreateMode, isEditMode, isRecallTestMode, isRebindMode } = useKnowledgeDetailMode()

	// Set selected knowledge on mount and cleanup on unmount
	useEffect(() => {
		knowledge.setSelectedKnowledge(knowledgeCode)
		return () => {
			knowledge.setSelectedKnowledge(null)
		}
	}, [knowledge, knowledgeCode])

	// Sync document selection from URL and auto-select first document
	useEffect(() => {
		const docCodeInUrl = searchParams.get("docCode")
		const documentListLength = knowledge.documentList.length
		const isDocumentLoading = knowledge.documentLoading
		const selectedDocumentCode = knowledge.selectedDocumentCode

		// 等待文档列表加载完成
		if (isDocumentLoading) return

		const hasDocuments = documentListLength > 0

		// 在召回测试模式、创建模式、编辑模式和重新绑定模式下，不自动同步文档选中状态
		const shouldSkipSync = isRecallTestMode || isCreateMode || isEditMode || isRebindMode

		if (docCodeInUrl) {
			// URL 中有 docCode，同步到 store
			const isDocumentInList = knowledge.documentList.some((doc) => doc.code === docCodeInUrl)

			if (isDocumentInList && selectedDocumentCode !== docCodeInUrl) {
				// URL 中的文档存在且未选中，同步到 store
				knowledge.selectDocument(docCodeInUrl)
			} else if (
				!isDocumentInList &&
				hasDocuments &&
				selectedDocumentCode &&
				crewCode &&
				!shouldSkipSync
			) {
				// URL 中的文档不存在（可能已被删除），但 store 已选中新文档，更新 URL
				navigate({
					name: RouteName.CrewEdit,
					params: { id: crewCode },
					query: {
						panel: CREW_EDIT_STEP.KnowledgeBase,
						code: knowledgeCode,
						docCode: selectedDocumentCode,
					},
					replace: true,
				})
			}
		} else if (hasDocuments && selectedDocumentCode && crewCode && !shouldSkipSync) {
			// URL 中没有 docCode，但 store 已经选中了文档（通常是自动选中的第一个）
			// 将 store 的选中状态同步到 URL
			// 注意：在召回测试、创建、编辑和重新绑定模式下不应该同步，避免意外跳转
			navigate({
				name: RouteName.CrewEdit,
				params: { id: crewCode },
				query: {
					panel: CREW_EDIT_STEP.KnowledgeBase,
					code: knowledgeCode,
					docCode: selectedDocumentCode,
				},
				replace: true, // 使用 replace 避免在历史记录中添加额外条目
			})
		}
		// MobX store 对象本身不应该作为依赖，只需要监听其具体属性
		// 使用 documentListLength 而不是 documentList，避免数组引用变化导致的过度触发
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		searchParams,
		knowledge.documentList.length, // 只监听长度，不监听整个数组
		knowledge.documentLoading,
		knowledge.selectedDocumentCode,
		navigate,
		crewCode,
		knowledgeCode,
		isCreateMode,
		isEditMode,
		isRecallTestMode,
		isRebindMode,
	])

	// Derive current knowledge from list
	const currentKnowledge = useMemo(
		() => knowledge.knowledgeList.find((kb) => kb.code === knowledgeCode),
		[knowledge.knowledgeList, knowledgeCode],
	)

	// 搜索结果为空时也要保留当前详情区，因此除了列表长度外，也要考虑当前选中文档上下文
	const documentListLength = knowledge.documentList.length
	const showDocumentSplit = useMemo(
		() =>
			documentListLength > 0 ||
			knowledge.selectedDocumentCode !== null ||
			knowledge.documentDetail !== null,
		[documentListLength, knowledge.documentDetail, knowledge.selectedDocumentCode],
	)

	return {
		currentKnowledge,
		showDocumentSplit,
		documentListLength,
	}
}
