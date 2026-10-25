import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import FileDownloadModal from "../index"
import type { OpenableProps } from "@/utils/react"

// Mock dependencies
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"share.download.modalTitle": "文件下载",
				"share.download.downloading": "文件下载中...",
				"share.download.thankYou": "文件下载中...",
				"share.download.downloadInstruction":
					"如果您的下载没有自动开始，请点击按钮进行下载",
				"share.download.fileName": "下载文件",
				"share.download.downloadFile": "下载文件",
				"share.download.copyLink": "复制链接",
				"share.download.copySuccess": "链接已复制",
			}
			return translations[key] || key
		},
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip", () => ({
	// Keep this modal test focused on download dialog behavior instead of antd Tooltip wiring.
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

describe("FileDownloadModal", () => {
	const mockOnClose = vi.fn()
	const mockOnDownload = vi.fn()
	const mockOnCopyLink = vi.fn()
	const mockOnAfterClose = vi.fn()

	const defaultProps: OpenableProps<{
		open: boolean
		onClose: () => void
		fileName: string
		downloadUrl: string
		onDownload?: () => void
		onCopyLink?: () => void
		onAfterClose?: () => void
	}> = {
		open: true,
		onClose: mockOnClose,
		fileName: "test-file.pdf",
		downloadUrl: "https://example.com/test-file.pdf",
		onDownload: mockOnDownload,
		onCopyLink: mockOnCopyLink,
		onAfterClose: mockOnAfterClose,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the modal when open is true", () => {
		render(<FileDownloadModal {...defaultProps} />)

		expect(screen.getByTestId("file-download-modal")).toBeInTheDocument()
		expect(screen.getByText("文件下载中...")).toBeInTheDocument()
		expect(screen.getByText("如果您的下载没有自动开始，请点击按钮进行下载")).toBeInTheDocument()
		expect(screen.getByText("test-file.pdf")).toBeInTheDocument()
	})

	it("calls onDownload without closing when download button is clicked", async () => {
		render(<FileDownloadModal {...defaultProps} />)

		const downloadButton = screen.getByTestId("file-download-modal-download-button")
		fireEvent.click(downloadButton)

		await waitFor(() => {
			expect(mockOnDownload).toHaveBeenCalledTimes(1)
			expect(mockOnClose).not.toHaveBeenCalled()
		})
	})

	it("renders the manual retry as a native link in a new tab", () => {
		render(<FileDownloadModal {...defaultProps} nativeDownload downloadTarget="_blank" />)

		const downloadLink = screen.getByTestId("file-download-modal-download-button")
		expect(downloadLink).toHaveAttribute("href", "https://example.com/test-file.pdf")
		expect(downloadLink).toHaveAttribute("target", "_blank")
		expect(downloadLink).toHaveAttribute("rel", "noopener noreferrer")
		expect(downloadLink).not.toHaveAttribute("download")

		fireEvent.click(downloadLink)
		expect(mockOnDownload).not.toHaveBeenCalled()
	})

	it("keeps the filename hint for native blob downloads", () => {
		render(
			<FileDownloadModal
				{...defaultProps}
				downloadUrl="blob:generated-zip"
				fileName="folder.zip"
				nativeDownload
			/>,
		)

		const downloadLink = screen.getByTestId("file-download-modal-download-button")
		expect(downloadLink).toHaveAttribute("href", "blob:generated-zip")
		expect(downloadLink).toHaveAttribute("download", "folder.zip")
	})

	it("calls onCopyLink without closing when copy link button is clicked", async () => {
		render(<FileDownloadModal {...defaultProps} />)

		const copyButton = screen.getByTestId("file-download-modal-copy-link-button")
		fireEvent.click(copyButton)

		await waitFor(() => {
			expect(mockOnCopyLink).toHaveBeenCalledTimes(1)
			expect(mockOnClose).not.toHaveBeenCalled()
		})
	})

	it("displays the correct file name", () => {
		render(<FileDownloadModal {...defaultProps} />)

		expect(screen.getByText("test-file.pdf")).toBeInTheDocument()
	})

	it("does not render when open is false", () => {
		render(<FileDownloadModal {...defaultProps} open={false} />)

		expect(screen.queryByText("文件下载中...")).not.toBeInTheDocument()
	})

	it("applies optional desktop modal z-index to the dialog content", () => {
		render(<FileDownloadModal {...defaultProps} modalZIndex={1300} />)

		const dialogContent = screen.getByTestId("file-download-modal")
		expect(dialogContent).toHaveStyle({ zIndex: "1300" })
	})

	it("runs close lifecycle callbacks only once", async () => {
		vi.useFakeTimers()
		render(<FileDownloadModal {...defaultProps} />)

		const closeButton = screen.getByTestId("file-download-modal-close-button")
		fireEvent.click(closeButton)
		fireEvent.click(closeButton)
		await vi.advanceTimersByTimeAsync(200)

		expect(mockOnAfterClose).toHaveBeenCalledTimes(1)
		expect(mockOnClose).toHaveBeenCalledTimes(1)
		vi.useRealTimers()
	})
})
