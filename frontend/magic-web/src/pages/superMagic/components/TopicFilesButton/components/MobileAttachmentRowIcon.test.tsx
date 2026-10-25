import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { AttachmentItem } from "../hooks/types"
import type { ReactNode } from "react"
import { MobileAttachmentRowIcon } from "./MobileAttachmentRowIcon"
import { FileResourceIcon } from "./FileResourceIcon"
import { getFilePresentationIndex, resolveFilePresentation } from "../utils/file-presentation"

vi.mock("./CustomFolderMagicIcon", () => ({
	CustomFolderMagicIcon: ({ childrenItems }: { childrenItems?: Array<unknown> }) => (
		<span
			data-testid="mobile-attachment-custom-folder-icon"
			data-children-count={childrenItems?.length ?? 0}
		/>
	),
}))

vi.mock("./ProjectFileImageThumbnailIcon", () => ({
	ProjectFileImageThumbnailIcon: ({
		item,
		fallback,
	}: {
		item: AttachmentItem
		fallback?: ReactNode
	}) =>
		item.file_extension === "png" ? (
			<span data-testid="project-file-image-thumbnail" data-file-id={item.file_id} />
		) : (
			fallback
		),
}))

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: ({ type }: { type?: string }) => (
		<span data-testid="mobile-attachment-magic-file-icon" data-icon-type={type} />
	),
}))

vi.mock("./SlidesTemplateFolderIcon", () => ({
	SlidesTemplateFolderIcon: () => <span data-testid="slides-template-icon" />,
}))

describe("MobileAttachmentRowIcon", () => {
	it.each(["micro-app", "html-app"])("preserves configured icons for %s projects", (type) => {
		const item: AttachmentItem = {
			file_id: "app-folder",
			name: "App",
			is_directory: true,
			display_config: { type, icon: "icon.png" },
			children: [{ file_id: "icon", name: "icon.png", file_extension: "png" }],
		}
		render(<MobileAttachmentRowIcon item={item} attachments={[item]} />)
		expect(screen.getByTestId("mobile-attachment-custom-folder-icon")).toHaveAttribute(
			"data-children-count",
			"1",
		)
	})

	it("uses the dedicated template icon through shared file presentation", () => {
		const item: AttachmentItem = {
			file_id: "template",
			name: "Template",
			is_directory: true,
			display_config: { type: "slide-template" },
		}
		render(<MobileAttachmentRowIcon item={item} attachments={[item]} />)
		expect(screen.getByTestId("slides-template-icon")).toBeInTheDocument()
	})

	it.each([undefined, null, {}])(
		"recognizes template structure when display_config is %s",
		(display_config) => {
			const item: AttachmentItem = {
				file_id: "template-root",
				name: "PPT-example",
				is_directory: true,
				display_config,
				children: [
					{ name: "template.json", is_directory: false },
					{ name: "visual-spec.md", is_directory: false },
					{ name: "theme.css", is_directory: false },
					{ name: "slides", is_directory: true },
				],
			}
			render(<MobileAttachmentRowIcon item={item} attachments={[item]} />)
			expect(screen.getByTestId("slides-template-icon")).toBeInTheDocument()
		},
	)

	it("uses the template icon for a desktop tree row resolved from the full snapshot", () => {
		const item: AttachmentItem = {
			file_id: "template-root",
			name: "PPT-example",
			is_directory: true,
			children: [
				{ name: "template.json", is_directory: false },
				{ name: "visual-spec.md", is_directory: false },
				{ name: "theme.css", is_directory: false },
				{ name: "slides", is_directory: true },
			],
		}
		const presentation = resolveFilePresentation(
			{ ...item, children: undefined },
			{
				context: { kind: "project", projectId: "example" },
				index: getFilePresentationIndex([item]),
			},
		)
		render(<FileResourceIcon presentation={presentation} size={16} />)
		expect(screen.getByTestId("slides-template-icon")).toBeInTheDocument()
	})

	it("keeps an incomplete template directory as an ordinary folder", () => {
		const item: AttachmentItem = {
			file_id: "ordinary-folder",
			name: "PPT-example",
			is_directory: true,
			children: [
				{ name: "template.json", is_directory: false },
				{ name: "slides", is_directory: true },
			],
		}
		render(<MobileAttachmentRowIcon item={item} attachments={[item]} />)
		expect(screen.queryByTestId("slides-template-icon")).not.toBeInTheDocument()
	})

	it("uses the full attachment tree when a custom folder item is missing children", () => {
		const customFolderSummary: AttachmentItem = {
			file_id: "file-special-folder",
			name: "fictional-special-folder",
			is_directory: true,
			display_config: {
				type: "custom",
				icon: "assets/icon.png",
			},
		}
		const attachments: AttachmentItem[] = [
			{
				...customFolderSummary,
				children: [
					{
						file_id: "file-icon",
						name: "icon.png",
						file_extension: "png",
						is_directory: false,
					},
				],
			},
		]

		render(<MobileAttachmentRowIcon item={customFolderSummary} attachments={attachments} />)

		expect(screen.getByTestId("mobile-attachment-custom-folder-icon")).toHaveAttribute(
			"data-children-count",
			"1",
		)
	})

	it("renders image files through the thumbnail component", () => {
		const imageItem: AttachmentItem = {
			file_id: "file-image",
			name: "cover.png",
			file_extension: "png",
			file_url: "https://cdn.example.com/cover.png",
		}

		render(<MobileAttachmentRowIcon item={imageItem} attachments={[]} />)

		expect(screen.getByTestId("project-file-image-thumbnail")).toHaveAttribute(
			"data-file-id",
			"file-image",
		)
	})
})
