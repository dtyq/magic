import { memo, useCallback } from "react"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { CREW_EDIT_STEP } from "../../../../store"
import { useCrewEditStore } from "../../../../context"
import { KnowledgeHeader } from "./KnowledgeHeader"
import { DocumentSplitLayout } from "./DocumentSplitLayout"
import type { BrowseModeViewProps } from "../types"

/**
 * Browse mode view component
 * Displays knowledge header and document split layout
 *
 * @param currentKnowledge - Current knowledge base data
 * @param showDocumentSplit - Whether to show split layout
 * @param onClose - Callback when close button is clicked
 * @param knowledgeCode - Code of the current knowledge base
 */
export const BrowseModeView = memo(function BrowseModeView({
	currentKnowledge,
	showDocumentSplit,
	onClose,
	knowledgeCode,
}: BrowseModeViewProps) {
	const navigate = useNavigate()
	const { knowledge, crewCode } = useCrewEditStore()

	// 检查当前知识库是否有文档
	const hasDocuments = knowledge.documentList.length > 0

	// 处理召回测试
	const handleRecallTest = useCallback(() => {
		if (!crewCode) return
		navigate({
			name: RouteName.CrewEdit,
			params: { id: crewCode },
			query: {
				panel: CREW_EDIT_STEP.KnowledgeBase,
				code: knowledgeCode,
				mode: "recallTest",
			},
		})
	}, [navigate, crewCode, knowledgeCode])

	return (
		<>
			<KnowledgeHeader
				knowledgeName={currentKnowledge?.name || ""}
				onClose={onClose}
				onRecallTest={handleRecallTest}
				showRecallTestButton={true}
				disableRecallTest={!hasDocuments}
			/>
			<DocumentSplitLayout showSplit={showDocumentSplit} knowledgeCode={knowledgeCode} />
		</>
	)
})
