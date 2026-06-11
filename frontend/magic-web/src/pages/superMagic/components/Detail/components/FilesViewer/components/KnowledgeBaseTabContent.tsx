import { memo } from "react"
import KnowledgeBasePreviewContent from "../../KnowledgeBasePreviewContent"
import type { KnowledgeBaseTabData } from "../hooks/useKnowledgeBaseTab"

export interface KnowledgeBaseTabContentProps {
	data: KnowledgeBaseTabData
}

function KnowledgeBaseTabContent({ data }: KnowledgeBaseTabContentProps) {
	return <KnowledgeBasePreviewContent data={data} />
}

export default memo(KnowledgeBaseTabContent)
