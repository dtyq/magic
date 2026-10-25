import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FileTabMagicIcon } from "../FileTabMagicIcon"
import type { FileItem } from "../../types"
import { toSlidesTemplatePreviewItem } from "@/pages/superMagic/components/TopicFilesButton/utils/slides-template-folder"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: ({ type }: { type?: string }) => <span data-testid="magic-file-icon">{type}</span>,
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon", () => ({
	CustomFolderMagicIcon: () => <span data-testid="custom-folder-icon" />,
}))

vi.mock(
	"@/pages/superMagic/components/TopicFilesButton/components/SlidesTemplateFolderIcon",
	() => ({
		SlidesTemplateFolderIcon: ({ size }: { size: number }) => (
			<span data-testid="slides-template-folder-icon">{size}</span>
		),
	}),
)

vi.mock("../../utils/websiteTabs", () => ({
	isWebsiteTab: () => false,
}))

describe("FileTabMagicIcon", () => {
	it("uses the template icon for slide-template tabs instead of the unknown file fallback", () => {
		render(
			<FileTabMagicIcon
				tab={
					{
						fileData: { display_config: { type: "slide-template" } },
					} as never
				}
				attachments={[]}
				isPlayback={false}
				size={16}
			/>,
		)

		expect(screen.getByTestId("slides-template-folder-icon")).toHaveTextContent("16")
		expect(screen.queryByTestId("magic-file-icon")).not.toBeInTheDocument()
	})

	it.each([undefined, null, {}])(
		"keeps the template icon after merging an attachment with display_config %s",
		(display_config) => {
			const attachment: AttachmentItem = {
				file_id: "template-root",
				file_name: "PPT-example",
				is_directory: true,
				display_config,
				children: [
					{ file_name: "template.json", is_directory: false },
					{ file_name: "visual-spec.md", is_directory: false },
					{ file_name: "theme.css", is_directory: false },
					{ file_name: "slides", is_directory: true },
				],
			}
			render(
				<FileTabMagicIcon
					tab={{ fileData: toSlidesTemplatePreviewItem(attachment) } as never}
					attachments={[attachment as unknown as FileItem]}
					context={{ kind: "project", projectId: "example" }}
					isPlayback={false}
					size={16}
				/>,
			)
			expect(screen.getByTestId("slides-template-folder-icon")).toBeInTheDocument()
			expect(screen.queryByTestId("magic-file-icon")).not.toBeInTheDocument()
		},
	)

	it("uses an app window icon for published micro-app tabs", () => {
		render(
			<FileTabMagicIcon
				tab={
					{
						type: "micro_app",
						fileData: {},
					} as never
				}
				attachments={[]}
				isPlayback={false}
				size={16}
			/>,
		)

		expect(screen.getByTestId("micro-app-tab-icon")).toBeInTheDocument()
		expect(screen.queryByTestId("magic-file-icon")).not.toBeInTheDocument()
	})
})
