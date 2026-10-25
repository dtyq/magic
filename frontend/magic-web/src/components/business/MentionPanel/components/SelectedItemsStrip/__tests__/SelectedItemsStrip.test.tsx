import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { zhCN } from "../../../i18n"
import { MentionItemType, type MentionItem } from "../../../types"
import type { PendingMentionEntry } from "../../../utils/multiSelect"
import SelectedItemsStrip from "../index"

const { mockFilePreviewById } = vi.hoisted(() => ({
	mockFilePreviewById: { "image-1": "https://example.com/cover.png" } as Record<string, string>,
}))

vi.mock("../../../renderers/context", () => ({
	useMentionItemRenderContextValue: () => ({ filePreviewById: mockFilePreviewById }),
}))

vi.mock("../../../runtime/builtin/domains/file-preview/MentionPanelFileImageIcon", () => ({
	MentionPanelFileImageIcon: ({
		iconSize,
		imageFit,
	}: {
		iconSize?: number
		imageFit?: string
	}) => <span data-testid="selected-item-thumbnail" data-size={iconSize} data-fit={imageFit} />,
}))

vi.mock("../../MentionVideoPreview", () => ({
	default: ({ item }: { item: MentionItem }) => (
		<span data-testid="selected-item-video-preview">{item.name}</span>
	),
}))

const image: MentionItem = {
	id: "image-1",
	type: MentionItemType.PROJECT_FILE,
	name: "cover.png",
	data: {
		file_id: "image-1",
		file_name: "cover.png",
		file_path: "images/cover.png",
		file_extension: "png",
	},
}

const imageEntry: PendingMentionEntry = {
	item: image,
	sourceRootId: "project-files",
}

const videoEntry: PendingMentionEntry = {
	item: {
		...image,
		id: "video-1",
		name: "clip.mp4",
		data: {
			file_id: "video-1",
			file_name: "clip.mp4",
			file_path: "videos/clip.mp4",
			file_extension: "mp4",
		},
	},
	sourceRootId: "project-files",
}

function renderStrip(isGalleryMode: boolean, onRemove = vi.fn()) {
	render(
		<SelectedItemsStrip
			entries={[imageEntry]}
			isGalleryMode={isGalleryMode}
			t={zhCN}
			onRemove={onRemove}
		/>,
	)
	return onRemove
}

describe("SelectedItemsStrip", () => {
	it("uses a compact card in list mode and a larger card in gallery mode", () => {
		const { rerender } = render(
			<SelectedItemsStrip
				entries={[imageEntry]}
				isGalleryMode={false}
				t={zhCN}
				onRemove={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("mention-panel-selected-item")).toHaveAttribute(
			"data-size",
			"list",
		)
		expect(screen.getByTestId("mention-panel-selected-item")).toHaveStyle({
			width: "36px",
			height: "36px",
		})
		expect(screen.getByTestId("selected-item-thumbnail")).toHaveAttribute("data-size", "36")
		expect(screen.getByTestId("selected-item-thumbnail")).toHaveAttribute("data-fit", "contain")

		rerender(
			<SelectedItemsStrip entries={[imageEntry]} isGalleryMode t={zhCN} onRemove={vi.fn()} />,
		)

		expect(screen.getByTestId("mention-panel-selected-item")).toHaveAttribute(
			"data-size",
			"gallery",
		)
		expect(screen.getByTestId("mention-panel-selected-item")).toHaveStyle({
			width: "60px",
			height: "60px",
		})
		expect(screen.getByTestId("selected-item-thumbnail")).toHaveAttribute("data-size", "60")
		expect(screen.getByTestId("selected-item-thumbnail")).toHaveAttribute("data-fit", "contain")
	})

	it("uses the full video preview for selected project videos", () => {
		render(
			<SelectedItemsStrip
				entries={[videoEntry]}
				isGalleryMode={false}
				t={zhCN}
				onRemove={vi.fn()}
			/>,
		)

		expect(screen.getByTestId("selected-item-video-preview")).toHaveTextContent("clip.mp4")
	})

	it("removes the selected item by its cross-directory selection key", () => {
		const onRemove = renderStrip(false)

		const removeButton = screen.getByTestId("mention-panel-selected-item-remove")
		expect(removeButton).toHaveClass("opacity-0", "group-hover/selected-item:opacity-100")
		fireEvent.click(removeButton)

		expect(onRemove).toHaveBeenCalledWith("project_file:image-1")
	})
})
