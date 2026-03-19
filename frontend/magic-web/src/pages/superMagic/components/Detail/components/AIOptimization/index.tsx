import { memo } from "react"
import AIEditButton from "../EditToolbar/AIEditButton"
import { AttachmentItem } from "../../../TopicFilesButton/hooks/types"

interface AIOptimizationProps {
	/** Attachment list for AI editing */
	attachmentList?: AttachmentItem[]
	/** Current file ID */
	file_id?: string
	/** Whether to show button text */
	showButtonText?: boolean
}

/**
 * AI Optimization component wrapper
 * Reuses AIEditButton with showButtonText enabled
 */
function AIOptimization({ attachmentList, file_id, showButtonText }: AIOptimizationProps) {
	return (
		<AIEditButton
			showButtonText={showButtonText}
			attachmentList={attachmentList}
			fileId={file_id}
		/>
	)
}

export default memo(AIOptimization)
