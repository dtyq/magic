import { describe, expect, it, vi } from "vitest"
import {
	handleAttachmentDragStart,
	handleMultipleFilesDragStart,
	PROJECT_ATTACHMENT_DRAG_MIME,
	PROJECT_IMAGE_ATTACHMENT_DRAG_MIME,
} from "../drag"

vi.mock(
	"@/components/CanvasDesign/components/MessageEditor/reference-assets/projectAttachmentDragHoverBridge",
	() => ({
		clearProjectAttachmentDragHoverPlainText: vi.fn(),
		setProjectAttachmentDragHoverPlainText: vi.fn(),
	}),
)

vi.mock("@/stores/projectFiles", () => ({ default: {} }))

vi.mock("../dragLogger", () => ({
	dragLogger: {
		startSession: vi.fn(),
		logDragStart: vi.fn(),
		logDragEnd: vi.fn(),
	},
}))

function createDragEvent() {
	const data = new Map<string, string>()
	return {
		dataTransfer: {
			types: [] as string[],
			setData(type: string, value: string) {
				data.set(type, value)
				if (!this.types.includes(type)) this.types.push(type)
			},
			getData(type: string) {
				return data.get(type) ?? ""
			},
			clearData() {
				data.clear()
				this.types = []
			},
		},
	} as unknown as React.DragEvent
}

describe("MessageEditor drag utils", () => {
	it("marks single project image drags with image MIME", () => {
		const event = createDragEvent()

		handleAttachmentDragStart(event, {
			file_id: "img-1",
			file_name: "cover.png",
			relative_file_path: "docs/images/cover.png",
			is_directory: false,
		} as any)

		expect(event.dataTransfer.types).toContain(PROJECT_ATTACHMENT_DRAG_MIME)
		expect(event.dataTransfer.types).toContain(PROJECT_IMAGE_ATTACHMENT_DRAG_MIME)
	})

	it("does not mark single non-image project file drags with image MIME", () => {
		const event = createDragEvent()

		handleAttachmentDragStart(event, {
			file_id: "doc-1",
			file_name: "brief.pdf",
			relative_file_path: "docs/brief.pdf",
			is_directory: false,
		} as any)

		expect(event.dataTransfer.types).toContain(PROJECT_ATTACHMENT_DRAG_MIME)
		expect(event.dataTransfer.types).not.toContain(PROJECT_IMAGE_ATTACHMENT_DRAG_MIME)
	})

	it("marks multiple project file drags with image MIME when any file is image", () => {
		const event = createDragEvent()

		handleMultipleFilesDragStart(event, [
			{
				file_id: "doc-1",
				file_name: "brief.pdf",
				relative_file_path: "docs/brief.pdf",
				is_directory: false,
			},
			{
				file_id: "img-1",
				file_name: "cover.webp",
				relative_file_path: "docs/images/cover.webp",
				is_directory: false,
			},
		] as any)

		expect(event.dataTransfer.types).toContain(PROJECT_IMAGE_ATTACHMENT_DRAG_MIME)
	})
})
