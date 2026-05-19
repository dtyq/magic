import { useCallback } from "react"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { CREW_EDIT_STEP } from "../../../../store"
import type { DocumentType } from "../components/DocumentCreate/constants"
import { useCrewEditStore } from "../../../../context"
import { useKnowledgeDetailMode } from "./useKnowledgeDetailMode"

interface UseKnowledgeNavigationParams {
	crewCode: string | undefined
	knowledgeCode: string
}

interface UseKnowledgeNavigationReturn {
	handleClose: () => void
	handleBackToList: (skipRefresh?: boolean) => Promise<void>
	navigateToCreate: (type: DocumentType) => void
}

/**
 * Hook to manage navigation actions for knowledge detail view
 * Provides callbacks for closing, returning to list, and navigating to create mode
 *
 * @param params - Object containing crewCode and knowledgeCode
 * @returns Object with navigation handler functions
 *
 * @example
 * const { handleClose, handleBackToList, navigateToCreate } = useKnowledgeNavigation({
 *   crewCode: 'crew-123',
 *   knowledgeCode: 'kb-456'
 * })
 */
export function useKnowledgeNavigation({
	crewCode,
	knowledgeCode,
}: UseKnowledgeNavigationParams): UseKnowledgeNavigationReturn {
	const navigate = useNavigate()
	const { knowledge } = useCrewEditStore()
	const { isCreateMode, isEditMode } = useKnowledgeDetailMode()

	const handleClose = useCallback(() => {
		if (!crewCode) return
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewCode },
			query: { panel: CREW_EDIT_STEP.KnowledgeBase },
		})
	}, [crewCode, navigate])

	const handleBackToList = useCallback(
		async (skipRefresh = false) => {
			if (!crewCode) return

			// 如果是创建模式，清空当前选中的文档，这样 fetchDocumentList 会自动选中第一个文档
			// 如果是编辑模式，保持当前选中状态
			if (isCreateMode) {
				knowledge.selectedDocumentCode = null
			}

			// 刷新文档列表，确保显示最新创建的文档
			// skipRefresh=true 时跳过刷新，由轮询机制自动处理（用于重新绑定场景）
			if (!skipRefresh) {
				await knowledge.fetchDocumentList(knowledgeCode)
			}

			navigate({
				name: RouteName.CrewEdit,
				params: { id: crewCode },
				query: {
					panel: CREW_EDIT_STEP.KnowledgeBase,
					code: knowledgeCode,
				},
			})
		},
		[crewCode, knowledgeCode, navigate, knowledge, isCreateMode],
	)

	const navigateToCreate = useCallback(
		(type: DocumentType) => {
			if (!crewCode) return
			navigate({
				name: RouteName.CrewEdit,
				params: { id: crewCode },
				query: {
					panel: CREW_EDIT_STEP.KnowledgeBase,
					code: knowledgeCode,
					mode: "create",
					type,
				},
			})
		},
		[crewCode, knowledgeCode, navigate],
	)

	return {
		handleClose,
		handleBackToList,
		navigateToCreate,
	}
}
