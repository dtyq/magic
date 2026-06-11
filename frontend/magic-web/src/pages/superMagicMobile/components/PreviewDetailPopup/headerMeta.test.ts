import { describe, expect, it, vi } from "vitest"
import type { TFunction } from "i18next"
import { DetailType } from "@/pages/superMagic/components/Detail/types"
import { getPreviewDetailDisplayName, isKnowledgeSearchPreviewDetail } from "./headerMeta"

const translate = vi.fn((key: string, defaultValue?: string) => defaultValue || key)
const t = translate as unknown as TFunction<"super">

describe("PreviewDetailPopup header metadata", () => {
	it("uses the knowledge search title instead of the generic preview title", () => {
		const detail = {
			type: DetailType.KnowledgeSearch,
			data: {
				type: "knowledge_search",
				query: "ES 搜索方案",
			},
		}

		expect(isKnowledgeSearchPreviewDetail(detail)).toBe(true)
		expect(getPreviewDetailDisplayName(detail, t)).toBe("知识库检索")
		expect(translate).toHaveBeenCalledWith("knowledgeSearch.title", "知识库检索")
		expect(translate).not.toHaveBeenCalledWith("ui.preview")
	})
})
