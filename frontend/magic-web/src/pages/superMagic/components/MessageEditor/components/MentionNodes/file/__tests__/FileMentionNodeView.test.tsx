import type { ComponentProps, ElementType, PropsWithChildren, ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import FileMentionNodeView from "../FileMentionNodeView"

const storeMocks = vi.hoisted(() => ({
	getFileById: vi.fn(),
	useMediaResourceSnapshot: vi.fn(() => ({
		snapshot: {
			identity: "project-file-1",
			status: "ready",
			thumbnailUrl: "https://cdn.test/project.png",
			previewUrl: "https://cdn.test/project.png",
		},
		loadPreview: vi.fn(),
	})),
}))

vi.mock("@/infrastructure/editors/tiptap/react", () => ({
	NodeViewWrapper: ({
		as: Component = "div",
		children,
		...props
	}: PropsWithChildren<{ as?: ElementType }>) => {
		const Wrapper = Component
		return <Wrapper {...props}>{children}</Wrapper>
	},
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	initReactI18next: { type: "3rdParty", init: vi.fn() },
}))

vi.mock("@/pages/superMagic/components/MessageEditor/stores", () => ({
	useOptionalMessageEditorStore: () => ({
		fileUploadStore: {
			getFileById: storeMocks.getFileById,
		},
	}),
}))

vi.mock("@/pages/superMagic/components/MessageEditor/components/AtItem/hooks/useObjectURL", () => ({
	default: () => null,
}))

vi.mock("@/services/media/MediaResourceRegistry", () => ({
	mediaResourceRegistry: {
		ensurePreview: vi.fn(),
	},
	useMediaResourceSnapshot: storeMocks.useMediaResourceSnapshot,
}))

vi.mock("@/components/base/MediaPreview", () => ({
	MediaPreviewThumbnail: ({ fallback }: { fallback: ReactNode }) => fallback,
	MediaPreviewTooltip: ({ children }: PropsWithChildren) => children,
	MediaPreviewTrigger: ({
		fallback,
		renderTrigger,
	}: {
		fallback: ReactNode
		renderTrigger: (thumbnail: ReactNode) => ReactNode
	}) => renderTrigger(fallback),
}))

function createProps(
	type: MentionItemType,
	data: Record<string, unknown>,
): ComponentProps<typeof FileMentionNodeView> {
	return {
		attrs: { type, data },
		selected: false,
		deleteNode: vi.fn(),
	} as unknown as ComponentProps<typeof FileMentionNodeView>
}

describe("FileMentionNodeView", () => {
	beforeEach(() => {
		storeMocks.getFileById.mockReset()
		storeMocks.useMediaResourceSnapshot.mockReset()
		storeMocks.useMediaResourceSnapshot.mockReturnValue({
			snapshot: {
				identity: "project-file-1",
				status: "ready",
				thumbnailUrl: "https://cdn.test/project.png",
				previewUrl: "https://cdn.test/project.png",
			},
			loadPreview: vi.fn(),
		})
	})

	it("keeps production upload progress behavior in the shared renderer", () => {
		storeMocks.getFileById.mockReturnValue({
			id: "file-1",
			name: "demo.mov",
			status: "uploading",
			progress: 42.4,
		})

		render(
			<FileMentionNodeView
				{...createProps(MentionItemType.UPLOAD_FILE, {
					file_id: "file-1",
					file_name: "demo.mov",
					file_extension: "mov",
				})}
			/>,
		)

		expect(screen.getByText("demo.mov")).toBeInTheDocument()
		expect(screen.getByTestId("upload-file-mention-visual")).toHaveClass("h-[18px]")
		expect(screen.getByTestId("upload-file-mention-progress")).toHaveTextContent("42%")
		expect(screen.getByTestId("upload-file-mention-progress-background")).toHaveStyle({
			width: "42%",
		})
	})

	it("renders project media mentions through the shared renderer", () => {
		render(
			<FileMentionNodeView
				{...createProps(MentionItemType.PROJECT_FILE, {
					file_id: "project-file-1",
					file_name: "project.png",
					file_extension: "png",
					file_path: "project.png",
				})}
			/>,
		)

		expect(screen.getByText("project.png")).toBeInTheDocument()
		expect(screen.getByTestId("file-mention-visual")).toBeInTheDocument()
		expect(storeMocks.useMediaResourceSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({
				identity: "project-file-1",
				mediaType: "image",
			}),
			expect.objectContaining({
				enabled: true,
				loadThumbnail: true,
			}),
		)
	})

	it("renders pending canvas file mentions with reduced opacity", () => {
		const props = createProps(MentionItemType.PROJECT_FILE, {
			file_id: "project-file-1",
			file_name: "project.png",
			file_extension: "png",
			file_path: "project.png",
		})

		render(
			<FileMentionNodeView
				{...props}
				attrs={{ ...props.attrs, pending: true, pendingId: "canvas-selection:1" }}
			/>,
		)

		expect(screen.getByText("project.png").closest(".magic-mention")).toHaveClass("opacity-50")
		expect(storeMocks.useMediaResourceSnapshot).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				loadThumbnail: true,
			}),
		)
	})
})
