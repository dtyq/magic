import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { zhCN } from "../../../i18n"
import { MentionItemType, type MentionItem } from "../../../types"
import GalleryItem from "../index"

const { mockFilePreviewById } = vi.hoisted(() => ({
	mockFilePreviewById: {
		"image-1": "https://example.com/image.png",
	} as Record<string, string>,
}))

vi.mock("../../../renderers/context", () => ({
	useMentionItemRenderContextValue: () => ({ filePreviewById: mockFilePreviewById }),
	useMentionItemRenderer: () => ({
		renderIcon: () => <span data-testid="file-icon" />,
	}),
}))

vi.mock("@/components/other/SmartTooltip", () => ({
	default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock("@/pages/superMagic/services/useFileMediaSource", () => ({
	useFileMediaSource: () => ({
		mediaType: "video" as const,
		previewUrl: "https://example.com/video.mp4",
		posterUrl: null,
		hasError: false,
		isLoading: false,
		loadPreview: vi.fn(),
	}),
}))

function createItem(id: string, extension: string): MentionItem {
	return {
		id,
		type: MentionItemType.PROJECT_FILE,
		name: `media.${extension}`,
		data: {
			file_id: id,
			file_name: `media.${extension}`,
			file_path: `media/media.${extension}`,
			file_extension: extension,
		},
	}
}

describe("GalleryItem media preview", () => {
	it("shows the complete image instead of cropping it", () => {
		render(<GalleryItem item={createItem("image-1", "png")} t={zhCN} />)

		expect(screen.getByTestId("mention-panel-gallery-preview-image")).toHaveClass(
			"object-contain",
		)
	})

	it("renders project videos with a contained preview", () => {
		render(<GalleryItem item={createItem("video-1", "mp4")} t={zhCN} />)

		expect(screen.getByTestId("mention-panel-gallery-video")).toHaveClass("object-contain")
		expect(screen.getByTestId("mention-panel-gallery-video")).toHaveAttribute(
			"src",
			"https://example.com/video.mp4",
		)
	})
})
