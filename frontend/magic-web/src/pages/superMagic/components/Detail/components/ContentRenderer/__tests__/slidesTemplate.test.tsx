import { Suspense } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DetailType } from "../../../types"
import ContentRenderer from "../index"

vi.mock("../../SlidesTemplateRootRender", () => ({
	default: ({ data }: { data: { file_id: string } }) => (
		<div data-testid="slides-template-renderer">{data.file_id}</div>
	),
}))

vi.mock("../../../contents/HTML", () => ({
	default: ({ data, isInPPTMode }: { data: { file_id: string }; isInPPTMode: boolean }) => (
		<div data-testid="html-renderer" data-ppt-mode={String(isInPPTMode)}>
			{data.file_id}
		</div>
	),
}))

describe("ContentRenderer slides template detail", () => {
	it("routes the template detail to SlidesTemplateRootRender", async () => {
		render(
			<Suspense fallback={null}>
				<ContentRenderer
					type={DetailType.SlidesTemplate}
					data={{ file_id: "template-root" }}
					commonProps={{ isPlaybackMode: false, showFileHeader: true }}
				/>
			</Suspense>,
		)

		expect(await screen.findByTestId("slides-template-renderer")).toHaveTextContent(
			"template-root",
		)
	})

	it("enables slide canvas scaling for a template HTML page", async () => {
		const slide = {
			file_id: "slide-1",
			file_name: "content-card.html",
			file_extension: "html",
			parent_id: "slides-dir",
		}
		const slidesDirectory = {
			file_id: "slides-dir",
			file_name: "slides",
			parent_id: "template-root",
			is_directory: true,
			children: [slide],
		}
		const root = {
			file_id: "template-root",
			file_name: "PPT-template",
			is_directory: true,
			children: [
				{ file_id: "manifest", file_name: "template.json", parent_id: "template-root" },
				{ file_id: "spec", file_name: "visual-spec.md", parent_id: "template-root" },
				{ file_id: "theme", file_name: "theme.css", parent_id: "template-root" },
				slidesDirectory,
			],
		}

		render(
			<Suspense fallback={null}>
				<ContentRenderer
					type={DetailType.Html}
					data={slide}
					commonProps={{
						isPlaybackMode: false,
						showFileHeader: true,
						attachmentList: [root],
					}}
				/>
			</Suspense>,
		)

		expect(await screen.findByTestId("html-renderer")).toHaveAttribute("data-ppt-mode", "true")
	})
})
