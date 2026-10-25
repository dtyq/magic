import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import {
	isFileInPPTMode,
	isFileInSlideCanvasMode,
	isFileInSlidesTemplateMode,
	shouldUseAudioRootRender,
} from "../file"
import { DetailType } from "../../types"

function createSlidesTemplateAttachments(): AttachmentItem[] {
	const slide: AttachmentItem = {
		file_id: "slide-1",
		file_name: "content-card.html",
		file_extension: "html",
		parent_id: "slides-dir",
		relative_file_path: "PPT-template/slides/content-card.html",
	}
	const slidesDirectory: AttachmentItem = {
		file_id: "slides-dir",
		file_name: "slides",
		parent_id: "template-root",
		relative_file_path: "PPT-template/slides",
		is_directory: true,
		children: [slide],
	}
	const root: AttachmentItem = {
		file_id: "template-root",
		file_name: "PPT-template",
		relative_file_path: "PPT-template",
		is_directory: true,
		children: [
			{ file_id: "manifest", file_name: "template.json", parent_id: "template-root" },
			{ file_id: "spec", file_name: "visual-spec.md", parent_id: "template-root" },
			{ file_id: "theme", file_name: "theme.css", parent_id: "template-root" },
			slidesDirectory,
		],
	}

	return [root]
}

describe("slide canvas mode", () => {
	it("recognizes HTML files inside a standard slides template", () => {
		const attachments = createSlidesTemplateAttachments()

		expect(isFileInSlidesTemplateMode("slide-1", attachments)).toBe(true)
		expect(isFileInSlideCanvasMode("slide-1", attachments)).toBe(true)
	})

	it("does not treat template metadata files as slide canvases", () => {
		expect(isFileInSlidesTemplateMode("manifest", createSlidesTemplateAttachments())).toBe(
			false,
		)
	})

	it("recognizes template slides from a flat attachment list", () => {
		const root = createSlidesTemplateAttachments()[0]
		const slidesDirectory = root.children?.find((item) => item.file_name === "slides")
		const slide = slidesDirectory?.children?.[0]
		const flatAttachments: AttachmentItem[] = [
			{ ...root, children: undefined },
			...(root.children || []).map((item) => ({ ...item, children: undefined })),
			...(slide ? [slide] : []),
		]

		expect(isFileInSlidesTemplateMode("slide-1", flatAttachments)).toBe(true)
	})

	it("keeps the existing PPT project detection", () => {
		const attachments: AttachmentItem[] = [
			{
				file_id: "ppt-root",
				file_name: "PPT-project",
				is_directory: true,
				display_config: { type: "slide" },
			},
			{
				file_id: "ppt-slide",
				file_name: "slide.html",
				file_extension: "html",
				parent_id: "ppt-root",
			},
		]

		expect(isFileInPPTMode("ppt-slide", attachments)).toBe(true)
		expect(isFileInSlideCanvasMode("ppt-slide", attachments)).toBe(true)
	})

	it("routes audio HTML entries to the recording root renderer", () => {
		expect(
			shouldUseAudioRootRender(DetailType.Html, {
				display_config: { type: "audio" },
			}),
		).toBe(true)
		expect(
			shouldUseAudioRootRender(DetailType.Html, {
				display_config: { type: "slide" },
			}),
		).toBe(false)
	})
})
