import { render, screen, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import Img from "../index"
import { ImagePrefix } from "../constants"
import { KnowledgeFileService } from "@/services/file/KnowledgeFile"

// Mock KnowledgeFileService
vi.mock("@/services/file/KnowledgeFile", () => ({
	KnowledgeFileService: {
		fetchFileUrl: vi.fn(),
	},
}))

// Mock ImageWrapper
vi.mock("@/components/base/MagicImagePreview/components/ImageWrapper", () => ({
	default: vi.fn(({ src, alt, onError, isLoading, isError, ...props }) => {
		if (isLoading) {
			return <div>📷 加载图片中...</div>
		}

		if (isError) {
			return <div>❌ 图片加载失败</div>
		}

		return <img src={src} alt={alt} onError={onError} data-testid="image-wrapper" {...props} />
	}),
}))

describe("Img Component", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should render normal image with regular src", () => {
		const normalSrc = "https://example.com/image.jpg"
		render(<Img src={normalSrc} alt="test image" />)

		const img = screen.getByTestId("image-wrapper")
		expect(img).toHaveAttribute("src", normalSrc)
		expect(img).toHaveAttribute("alt", "test image")
	})

	it("should show loading state for magic_knowledge_base_file_ format", async () => {
		const mockFileKey = "test_file_key"
		const magicSrc = `${ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE}${mockFileKey}`

		// Mock service call to be pending
		const mockPromise = new Promise<any>(() => { }) // Never resolves
		vi.mocked(KnowledgeFileService.fetchFileUrl).mockReturnValue(mockPromise)

		render(<Img src={magicSrc} alt="magic image" />)

		expect(screen.getByText("📷 加载图片中...")).toBeInTheDocument()
		expect(KnowledgeFileService.fetchFileUrl).toHaveBeenCalledWith(mockFileKey)
	})

	it("should render image with download URL from service response", async () => {
		const mockFileKey = "test_file_key"
		const magicSrc = `${ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE}${mockFileKey}`
		const mockDownloadUrl = "https://example.com/download/image.jpg"

		// Mock successful service response
		vi.mocked(KnowledgeFileService.fetchFileUrl).mockResolvedValue({
			url: mockDownloadUrl,
			expires: 1748002048,
			name: "test.png",
			uid: "test_uid",
			key: "test_key",
			file_key: mockFileKey,
			cached_at: Date.now(),
		})

		render(<Img src={magicSrc} alt="magic image" />)

		// Wait for service call to complete
		await waitFor(() => {
			const img = screen.getByTestId("image-wrapper")
			expect(img).toHaveAttribute("src", mockDownloadUrl)
		})

		expect(KnowledgeFileService.fetchFileUrl).toHaveBeenCalledWith(mockFileKey)
	})

	it("should show error state when service call fails", async () => {
		const mockFileKey = "test_file_key"
		const magicSrc = `${ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE}${mockFileKey}`

		// Mock service call failure
		vi.mocked(KnowledgeFileService.fetchFileUrl).mockRejectedValue(new Error("Service Error"))

		render(<Img src={magicSrc} alt="magic image" />)

		await waitFor(() => {
			expect(screen.getByText("❌ 图片加载失败")).toBeInTheDocument()
		})

		expect(KnowledgeFileService.fetchFileUrl).toHaveBeenCalledWith(mockFileKey)
	})

	it("should show error state when service returns null", async () => {
		const mockFileKey = "test_file_key"
		const magicSrc = `${ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE}${mockFileKey}`

		// Mock service response as null
		vi.mocked(KnowledgeFileService.fetchFileUrl).mockResolvedValue(null)

		render(<Img src={magicSrc} alt="magic image" />)

		await waitFor(() => {
			expect(screen.getByText("❌ 图片加载失败")).toBeInTheDocument()
		})
	})

	it("should show error state for empty file key", () => {
		const magicSrc = ImagePrefix.MAGIC_KNOWLEDGE_BASE_FILE

		render(<Img src={magicSrc} alt="magic image" />)

		expect(screen.getByText("❌ 图片加载失败")).toBeInTheDocument()
		expect(KnowledgeFileService.fetchFileUrl).not.toHaveBeenCalled()
	})

	it("should apply custom styles to ImageWrapper", () => {
		const customStyle = { width: "200px", height: "150px" }
		render(<Img src="https://example.com/image.jpg" style={customStyle} />)

		const img = screen.getByTestId("image-wrapper")
		expect(img).toHaveAttribute("style", expect.stringContaining("width: 200px"))
		expect(img).toHaveAttribute("style", expect.stringContaining("height: 150px"))
	})
})
