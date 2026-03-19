import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import FileDownloadModal from "../index"
import type { OpenableProps } from "@/utils/react"

// Mock dependencies
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"share.download.modalTitle": "文件下载",
				"share.download.downloading": "文件下载中...",
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

describe("FileDownloadModal", () => {
	const mockOnClose = vi.fn()
	const mockOnDownload = vi.fn()
	const mockOnCopyLink = vi.fn()

	const defaultProps: OpenableProps<{
		open: boolean
		onClose: () => void
		fileName: string
		downloadUrl: string
		onDownload?: () => void
		onCopyLink?: () => void
	}> = {
		open: true,
		onClose: mockOnClose,
		fileName: "test-file.pdf",
		downloadUrl: "https://example.com/test-file.pdf",
		onDownload: mockOnDownload,
		onCopyLink: mockOnCopyLink,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the modal when open is true", () => {
		render(<FileDownloadModal {...defaultProps} />)

		expect(screen.getByText("文件下载中...")).toBeInTheDocument()
		expect(screen.getByText("如果您的下载没有自动开始，请点击按钮进行下载")).toBeInTheDocument()
		expect(screen.getByText("test-file.pdf")).toBeInTheDocument()
	})

	it("calls onDownload and onClose when download button is clicked", async () => {
		render(<FileDownloadModal {...defaultProps} />)

		const downloadButton = screen.getByRole("button", { name: /下载文件/ })
		fireEvent.click(downloadButton)

		await waitFor(() => {
			expect(mockOnDownload).toHaveBeenCalledTimes(1)
			expect(mockOnClose).toHaveBeenCalledTimes(1)
		})
	})

	it("calls onCopyLink and onClose when copy link button is clicked", async () => {
		render(<FileDownloadModal {...defaultProps} />)

		const copyButton = screen.getByRole("button", { name: /复制链接/ })
		fireEvent.click(copyButton)

		await waitFor(() => {
			expect(mockOnCopyLink).toHaveBeenCalledTimes(1)
			expect(mockOnClose).toHaveBeenCalledTimes(1)
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
})
