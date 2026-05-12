import { memo } from "react"
import { DocumentCreate } from "./DocumentCreate"
import type { CreateModeViewProps } from "../types"

/**
 * Create mode view component
 * Full-screen document creation interface
 *
 * @param knowledgeCode - Code of the knowledge base
 * @param documentType - Type of document to create
 * @param knowledgeName - Name of the knowledge base
 * @param editMode - Whether in edit mode (skip first step)
 * @param editDocumentCode - Document code for edit mode
 * @param onComplete - Callback when creation is complete
 * @param onCancel - Callback when creation is cancelled
 */
export const CreateModeView = memo(function CreateModeView({
	knowledgeCode,
	documentType,
	knowledgeName,
	editMode,
	editDocumentCode,
	onComplete,
	onCancel,
}: CreateModeViewProps) {
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<DocumentCreate
				knowledgeCode={knowledgeCode}
				documentType={documentType}
				knowledgeName={knowledgeName}
				editMode={editMode}
				editDocumentCode={editDocumentCode}
				onComplete={onComplete}
				onCancel={onCancel}
			/>
		</div>
	)
})
