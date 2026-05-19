import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StreamingHtmlPreviewRenderer } from "../StreamingHtmlPreviewRenderer"

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils", () => ({
	rewriteHtmlWithMagicCdn: (content: string) => content,
}))

vi.mock("@/pages/superMagic/components/Detail/contents/HTML/utils/full-content", () => ({
	decodeHTMLEntities: (content: string) => content,
	getFullContent: (content: string) => content,
}))

describe("StreamingHtmlPreviewRenderer", () => {
	it("preserves the iframe scroll position across streaming updates", () => {
		render(
			<StreamingHtmlPreviewRenderer
				content={"<!DOCTYPE html><html><body><div>Hello</div></body></html>"}
				onReady={vi.fn()}
				onMetrics={vi.fn()}
			/>,
		)

		const runtimeDocument =
			screen.getByTestId("streaming-html-preview-renderer").getAttribute("srcdoc") ?? ""

		expect(runtimeDocument).toContain("scrollRestoreFrameId")
		expect(runtimeDocument).toContain("function captureScrollPosition()")
		expect(runtimeDocument).toContain("function scheduleScrollRestore(scrollPosition)")
		expect(runtimeDocument).toContain("patchBodyContent(parsedDocument, scrollPosition)")
		expect(runtimeDocument).toContain("scheduleScrollRestore(scrollPosition);")
	})
})
