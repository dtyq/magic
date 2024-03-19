import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
// @ts-ignore
import ImagePreview from "../index"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/ImagePreviewStore"
import MessageFilePreviewService from "@/opensource/services/chat/message/MessageFilePreview"

// Mock dependencies
vi.mock("@/opensource/stores/chatNew/messagePreview/ImagePreviewStore", () => ({
	default: {
		open: false,
		previewInfo: undefined,
		setOpen: vi.fn(),
	},
}))

vi.mock("@/opensource/services/chat/message/MessageFilePreview", () => ({
	default: {
		clearPreviewInfo: vi.fn(),
	},
}))

vi.mock("../hooks/useImagePreview", () => ({
	default: vi.fn(() => ({
		loading: false,
		progress: 0,
		currentImage: "test-image.jpg",
		onDownload: vi.fn(),
		onHighDefinition: vi.fn(),
		navigateToMessage: vi.fn(),
	})),
}))

vi.mock("../components/ImageViewer/index", () => ({
	default: vi.fn(({ onClose, renderActionBar }) => (
		<div data-testid="image-viewer">
			<button onClick={onClose}>Close</button>
			{renderActionBar && renderActionBar()}
		</div>
	)),
}))

vi.mock("../components/ActionBar/index", () => ({
	default: vi.fn(({ onClose }) => (
		<div data-testid="action-bar">
			<button onClick={onClose}>Close Action</button>
		</div>
	)),
}))

vi.mock("@/opensource/utils/historyStackManager/hooks", () => ({
	default: vi.fn(() => ({
		cleanup: vi.fn(),
	})),
}))

vi.mock("antd-mobile", () => ({
	Popup: vi.fn(({ children, visible }) =>
		visible ? <div data-testid="popup">{children}</div> : null,
	),
}))

describe("ImagePreview", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should not render when store open is false", () => {
		// @ts-ignore
		MessageFilePreviewStore.open = false

		render(<ImagePreview />)

		// Popup should not be visible when open is false
		expect(screen.queryByTestId("image-viewer")).not.toBeInTheDocument()
	})

	it("should render when store open is true", () => {
		// @ts-ignore
		MessageFilePreviewStore.open = true

		render(<ImagePreview />)

		expect(screen.getByTestId("image-viewer")).toBeInTheDocument()
		expect(screen.getByTestId("action-bar")).toBeInTheDocument()
	})

	it("should call store setOpen and service clearPreviewInfo when closed", () => {
		// @ts-ignore
		MessageFilePreviewStore.open = true

		render(<ImagePreview />)

		// Click close button in ImageViewer
		fireEvent.click(screen.getByText("Close"))

		expect(MessageFilePreviewStore.setOpen).toHaveBeenCalledWith(false)
		expect(MessageFilePreviewService.clearPreviewInfo).toHaveBeenCalled()
	})

	it("should pass correct props to child components", () => {
		// @ts-ignore
		MessageFilePreviewStore.open = true
		// @ts-ignore
		MessageFilePreviewStore.previewInfo = {
			fileId: "test-file-id",
			url: "test-url",
		}

		render(<ImagePreview />)

		expect(screen.getByTestId("image-viewer")).toBeInTheDocument()
		expect(screen.getByTestId("action-bar")).toBeInTheDocument()
	})
})
