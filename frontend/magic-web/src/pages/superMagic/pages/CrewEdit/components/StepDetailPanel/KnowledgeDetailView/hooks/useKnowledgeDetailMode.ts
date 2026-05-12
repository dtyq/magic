import { useSearchParams } from "react-router-dom"
import {
	DOCUMENT_TYPES,
	type DocumentType,
} from "../components/DocumentCreate/constants/document-types"

interface UseKnowledgeDetailModeReturn {
	mode: string | null
	documentType: DocumentType | null
	isCreateMode: boolean
	isEditMode: boolean
	isRecallTestMode: boolean
	isRebindMode: boolean
	editDocumentCode: string | null
}

/**
 * Hook to parse and manage URL-based mode state for knowledge detail view
 *
 * @returns Object containing current mode, document type, and derived mode flags
 *
 * @example
 * const { isCreateMode, isEditMode, documentType } = useKnowledgeDetailMode()
 * if (isCreateMode) {
 *   // Render create mode UI
 * } else if (isEditMode) {
 *   // Render edit mode UI (skip first step, pre-fill config)
 * }
 */
export function useKnowledgeDetailMode(): UseKnowledgeDetailModeReturn {
	const [searchParams] = useSearchParams()

	const mode = searchParams.get("mode")
	const typeParam = searchParams.get("type")
	// 验证 type 参数是否是有效的 DocumentType
	const documentType =
		typeParam && Object.values(DOCUMENT_TYPES).includes(typeParam as DocumentType)
			? (typeParam as DocumentType)
			: null
	const editDocumentCode = searchParams.get("docCode")
	const rebind = searchParams.get("rebind")
	const isCreateMode = mode === "create" && !!documentType && !editDocumentCode
	const isEditMode = mode === "edit" && !!documentType && !!editDocumentCode
	const isRecallTestMode = mode === "recallTest"
	const isRebindMode = rebind === "true"

	return {
		mode,
		documentType,
		isCreateMode,
		isEditMode,
		isRecallTestMode,
		isRebindMode,
		editDocumentCode,
	}
}
