import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { I18nTexts } from "../../../../../i18n/types"
import { MentionItemType } from "../../../../../types"
import { renderMentionFolderIcon } from "../render-utils"
import { MentionPanelResourceIcon } from "../resource-icon"

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: ({ type }: { type: string }) => (
		<span data-testid="magic-file-icon" data-type={type} />
	),
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon", () => ({
	CustomFolderMagicIcon: ({ typeFallback }: { typeFallback?: string }) => (
		<span data-testid="custom-folder-icon" data-type={typeFallback} />
	),
}))

vi.mock(
	"@/pages/superMagic/components/TopicFilesButton/components/SlidesTemplateFolderIcon",
	() => ({
		SlidesTemplateFolderIcon: () => <span data-testid="slides-template-icon" />,
	}),
)

vi.mock("@/stores/projectFiles", () => ({
	default: { workspaceFilesList: [] },
}))

describe("MentionPanelResourceIcon", () => {
	it("uses the dedicated slides-template icon for special display types", () => {
		const { queryByTestId } = render(
			<MentionPanelResourceIcon displayConfig={{ type: "slide-template" }} size={16} />,
		)

		expect(queryByTestId("slides-template-icon")).not.toBeNull()
		expect(queryByTestId("magic-file-icon")).toBeNull()
	})

	it("returns no icon when there is no display config", () => {
		const { container } = render(<MentionPanelResourceIcon size={16} />)

		expect(container.firstChild).toBeNull()
	})

	it("uses the same resolver for slide-template folder mentions", () => {
		const icon = renderMentionFolderIcon({
			item: {
				id: "template-folder",
				name: "PPT-soft-pink-midyear-review",
				type: MentionItemType.FOLDER,
				icon: "file-folder",
				data: {
					directory_id: "template-folder",
					directory_name: "PPT-soft-pink-midyear-review",
					directory_path: "PPT-soft-pink-midyear-review",
					directory_metadata: { type: "slide-template" },
				},
			},
			t: {} as I18nTexts,
			platform: "desktop",
		})

		const { queryByTestId } = render(<>{icon}</>)
		expect(queryByTestId("slides-template-icon")).not.toBeNull()
	})

	it("uses a globe icon for website resources", () => {
		const { container, queryByTestId } = render(
			<MentionPanelResourceIcon displayConfig={{ type: "website" }} size={16} />,
		)

		expect(queryByTestId("magic-file-icon")).toBeNull()
		expect(container.querySelector("svg")).not.toBeNull()
	})

	it("uses custom folder icons for custom resources", () => {
		const { getByTestId, queryByTestId } = render(
			<MentionPanelResourceIcon
				displayConfig={{ type: "custom" }}
				typeFallback="folder"
				size={16}
			/>,
		)

		expect(getByTestId("custom-folder-icon").dataset.type).toBe("folder")
		expect(queryByTestId("magic-file-icon")).toBeNull()
	})

	it("uses custom folder icons for directory-like micro apps", () => {
		const { getByTestId, queryByTestId } = render(
			<MentionPanelResourceIcon
				displayConfig={{ type: "micro-app" }}
				isDirectoryLike
				size={16}
			/>,
		)

		expect(getByTestId("custom-folder-icon").dataset.type).toBe("micro-app")
		expect(queryByTestId("magic-file-icon")).toBeNull()
	})

	it("uses file icons for non-directory micro app resources", () => {
		const { getByTestId, queryByTestId } = render(
			<MentionPanelResourceIcon displayConfig={{ type: "micro-app" }} size={16} />,
		)

		expect(getByTestId("magic-file-icon").dataset.type).toBe("micro-app")
		expect(queryByTestId("custom-folder-icon")).toBeNull()
	})

	it("normalizes ordinary display types through the attachment resolver", () => {
		const { getByTestId } = render(
			<MentionPanelResourceIcon displayConfig={{ type: "slide" }} size={16} />,
		)

		expect(getByTestId("magic-file-icon").dataset.type).toBe("ppt")
	})
})
