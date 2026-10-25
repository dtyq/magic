import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { I18nTexts } from "../../../../../i18n/types"
import { MentionItemType } from "../../../../../types"
import { setCanvasElementResourceGetter } from "../../canvas-elements/resource-registry"
import { MentionPanelFileImageIcon } from "../MentionPanelFileImageIcon"

vi.mock("@/components/base/MagicFileIcon", () => ({
	default: ({ type, size }: { type: string; size: number }) => (
		<span data-testid="magic-file-icon" data-size={size} data-type={type} />
	),
}))

vi.mock("@/stores/projectFiles", () => ({
	default: {
		workspaceFilesList: [],
		getFolderData: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon", () => ({
	CustomFolderMagicIcon: () => <span data-testid="custom-folder-icon" />,
}))

vi.mock(
	"@/pages/superMagic/components/TopicFilesButton/components/SlidesTemplateFolderIcon",
	() => ({
		SlidesTemplateFolderIcon: () => <span data-testid="slides-template-icon" />,
	}),
)

vi.mock("@/pages/superMagic/components/MessageList/components/MessageAttachment/utils", () => ({
	getFileTreeIconType: vi.fn(() => ""),
}))

describe("MentionPanelFileImageIcon", () => {
	it("uses the dedicated icon for slide-template files", () => {
		const { queryByTestId } = render(
			<MentionPanelFileImageIcon
				context={{
					item: {
						id: "template-1",
						type: MentionItemType.PROJECT_FILE,
						name: "PPT-soft-pink-midyear-review",
						displayConfig: { type: "slide-template" },
						icon: "slide-template",
						data: {
							file_id: "template-1",
							file_name: "PPT-soft-pink-midyear-review",
							file_path: "PPT-soft-pink-midyear-review",
							file_extension: "",
						},
					},
					t: {} as I18nTexts,
					platform: "desktop",
				}}
			/>,
		)

		expect(queryByTestId("slides-template-icon")).not.toBeNull()
		expect(queryByTestId("magic-file-icon")).toBeNull()
	})

	it("keeps loaded image previews inside a fixed desktop icon box", async () => {
		const { container } = render(
			<MentionPanelFileImageIcon
				context={{
					item: {
						id: "image-1",
						type: MentionItemType.PROJECT_FILE,
						name: "portrait.png",
						icon: "png",
						data: {
							file_id: "file-1",
							file_name: "portrait.png",
							file_path: "assets/portrait.png",
							file_extension: "png",
						},
					},
					t: {} as I18nTexts,
					platform: "desktop",
					filePreviewById: {
						"file-1": "https://example.com/portrait.png",
					},
				}}
			/>,
		)

		const loadingImage = container.querySelector("img")
		expect(loadingImage).not.toBeNull()
		fireEvent.load(loadingImage as HTMLImageElement)

		await waitFor(() => {
			const loadedImage = container.querySelector("img")
			expect(loadedImage).toHaveClass("block", "h-full", "w-full", "object-cover")
			expect(loadedImage?.parentElement).toHaveStyle({
				width: "16px",
				height: "16px",
				minWidth: "16px",
				minHeight: "16px",
				maxWidth: "16px",
				maxHeight: "16px",
			})
		})
	})

	it("does not use project preview cache for canvas element thumbnails", async () => {
		const { container } = render(
			<MentionPanelFileImageIcon
				context={{
					item: {
						id: "canvas-elements:element:hero",
						type: MentionItemType.PROJECT_FILE,
						name: "Hero Layer",
						icon: "png",
						tags: ["canvas-element"],
						sourcePreview: {
							kind: "canvas-element",
							elementId: "hero",
							mediaType: "image",
							src: "./images/hero.png",
						},
						data: {
							file_id: "file-1",
							file_name: "portrait.png",
							file_path: "assets/portrait.png",
							file_extension: "png",
						},
					},
					t: {} as I18nTexts,
					platform: "desktop",
					filePreviewById: {
						"file-1": "https://example.com/stale-project-preview.png",
					},
				}}
			/>,
		)

		expect(container.querySelector("img")).toBeNull()
		expect(container.querySelector("[data-testid='magic-file-icon']")).toBeNull()
		expect(container.querySelector("[data-testid='canvas-element-image-icon']")).not.toBeNull()
	})

	it("uses active canvas resources for canvas element thumbnails outside CanvasProvider", async () => {
		const lowImageResult = {
			url: "blob:canvas-low-preview",
			imageInfo: {
				naturalWidth: 100,
				naturalHeight: 50,
				fileSize: 1000,
				mimeType: "image/png",
				filename: "hero.png",
			},
			release: vi.fn(),
		}
		let resolveLowImage: (value: typeof lowImageResult) => void = () => undefined
		const lowImagePromise = new Promise<typeof lowImageResult>((resolve) => {
			resolveLowImage = resolve
		})
		const getLowImageUrl = vi.fn(() => lowImagePromise)
		const fakeCanvas = {
			imageResourceManager: {
				getLowImageUrl,
			},
			elementManager: {
				getElementInstance: vi.fn(() => null),
			},
		}
		setCanvasElementResourceGetter("design-a", () => fakeCanvas as any)

		try {
			let container!: HTMLElement
			await act(async () => {
				container = render(
					<MentionPanelFileImageIcon
						context={{
							item: {
								id: "canvas-elements:element:hero",
								type: MentionItemType.PROJECT_FILE,
								name: "Hero Layer",
								icon: "png",
								tags: ["canvas-element"],
								sourcePreview: {
									kind: "canvas-element",
									designProjectId: "design-a",
									elementId: "hero",
									mediaType: "image",
									src: "./images/hero.png",
								},
								data: {
									file_id: "file-1",
									file_name: "portrait.png",
									file_path: "assets/portrait.png",
									file_extension: "png",
								},
							},
							t: {} as I18nTexts,
							platform: "desktop",
							filePreviewById: {},
						}}
					/>,
				).container
			})
			await waitFor(() => {
				expect(getLowImageUrl).toHaveBeenCalledWith("./images/hero.png")
			})
			await act(async () => {
				resolveLowImage(lowImageResult)
				await lowImagePromise
			})
			await waitFor(() => {
				expect(
					container!.querySelector("[data-testid='canvas-element-image-preview']"),
				).not.toBeNull()
			})
		} finally {
			setCanvasElementResourceGetter("design-a", null)
		}
	})
})
