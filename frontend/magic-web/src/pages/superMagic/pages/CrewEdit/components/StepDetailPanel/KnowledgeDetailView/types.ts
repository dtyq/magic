import type { ReactNode } from "react"
import type { Knowledge } from "@/types/knowledge"
import { type DocumentType } from "./components/DocumentCreate/constants/document-types"

export interface KnowledgeDetailViewProps {
	knowledgeCode: string
}

export interface KnowledgeHeaderProps {
	knowledgeName: string
	onClose: () => void
	onRecallTest?: () => void
	showRecallTestButton?: boolean
	disableRecallTest?: boolean
}

export interface DocumentSplitLayoutProps {
	showSplit: boolean
	children: {
		list: ReactNode
		detail: ReactNode
	}
	knowledgeCode: string
}

export interface CreateModeViewProps {
	knowledgeCode: string
	documentType: DocumentType
	knowledgeName: string | undefined
	editMode?: boolean
	editDocumentCode?: string | null
	onComplete: () => void
	onCancel: () => void
}

export interface BrowseModeViewProps {
	currentKnowledge: Knowledge.KnowledgeItem | undefined
	showDocumentSplit: boolean
	onClose: () => void
	knowledgeCode: string
}
