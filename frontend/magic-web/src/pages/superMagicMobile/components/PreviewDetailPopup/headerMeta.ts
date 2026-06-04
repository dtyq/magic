import type { TFunction } from "i18next"
import { DetailType } from "@/pages/superMagic/components/Detail/types"

interface PreviewHeaderDetail {
	type?: string
	name?: string
	data?: {
		name?: string
		file_name?: string
		title?: string
		type?: string
		display_config?: { name?: string }
	}
}

export function isKnowledgeSearchPreviewDetail(detail?: PreviewHeaderDetail) {
	return (
		detail?.type === DetailType.KnowledgeSearch ||
		detail?.name === "search_knowledge" ||
		detail?.data?.type === DetailType.KnowledgeSearch
	)
}

export function getPreviewDetailDisplayName(
	detail: PreviewHeaderDetail | undefined,
	t: TFunction<"super">,
) {
	if (isKnowledgeSearchPreviewDetail(detail)) {
		return t("knowledgeSearch.title", "知识库检索")
	}

	if (!detail?.data) return t("ui.preview")

	const data = detail.data

	if (detail.type === DetailType.Design) {
		return data.name || data.display_config?.name || data.file_name || t("ui.preview")
	}

	return data.display_config?.name || data.file_name || data.title || t("ui.preview")
}
