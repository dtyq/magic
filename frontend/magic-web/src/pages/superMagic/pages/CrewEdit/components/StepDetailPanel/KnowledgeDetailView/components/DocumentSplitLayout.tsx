import { memo } from "react"
import { cn } from "@/lib/tiptap-utils"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import TopicResizeHandle from "@/pages/superMagic/pages/TopicPage/components/TopicResizeHandle"
import { KNOWLEDGE_DETAIL_PANEL_WIDTH_TRANSITION } from "../layout-transition"
import {
	KNOWLEDGE_DOC_LIST_DEFAULT_PX,
	KNOWLEDGE_DOC_LIST_MIN_PX,
	KNOWLEDGE_DOC_LIST_MAX_PX,
	CREW_EDIT_KNOWLEDGE_DOC_LIST_WIDTH_KEY,
} from "../constants"
import type { DocumentSplitLayoutProps } from "../types"
import DocumentListPanel from "./DocumentListPanel"
import DocumentDetailPanel from "./DocumentDetailPanel"

/**
 * Document split layout component
 * Manages resizable document list and detail panels
 *
 * @param showSplit - Whether to show the split layout or full-width list
 * @param children - Not used, panels are rendered internally
 * @param knowledgeCode - Code of the current knowledge base
 */
export const DocumentSplitLayout = memo(function DocumentSplitLayout({
	showSplit,
	knowledgeCode,
}: Omit<DocumentSplitLayoutProps, "children">) {
	const {
		width: documentListWidthPx,
		isDragging: isDraggingDocumentList,
		handleMouseDown: onDocumentListResizeStart,
	} = useResizablePanel({
		minWidth: KNOWLEDGE_DOC_LIST_MIN_PX,
		maxWidth: KNOWLEDGE_DOC_LIST_MAX_PX,
		defaultWidth: KNOWLEDGE_DOC_LIST_DEFAULT_PX,
		storageKey: CREW_EDIT_KNOWLEDGE_DOC_LIST_WIDTH_KEY,
		direction: "left",
	})

	const documentListWidthTransition = isDraggingDocumentList
		? "none"
		: KNOWLEDGE_DETAIL_PANEL_WIDTH_TRANSITION

	if (!showSplit) {
		return (
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<DocumentListPanel />
			</div>
		)
	}

	return (
		<div className="flex min-h-0 min-w-0 flex-1">
			<div
				className="flex h-full shrink-0 flex-col"
				style={{
					width: documentListWidthPx,
					minWidth: 0,
					willChange: isDraggingDocumentList ? "width" : undefined,
					transition: documentListWidthTransition,
				}}
			>
				<DocumentListPanel />
			</div>
			<TopicResizeHandle
				onMouseDown={onDocumentListResizeStart}
				className={cn("shrink-0", isDraggingDocumentList && "before:opacity-100")}
			/>
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-border">
				<DocumentDetailPanel knowledgeCode={knowledgeCode} />
			</div>
		</div>
	)
})
