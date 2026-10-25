import { describe, it, expect, vi, beforeEach } from "vitest"
import { SlideProcessorService } from "../SlideProcessorService"
import * as htmlProcessor from "@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor"
import { HTML_PREVIEW_IMAGE_PROCESS } from "@/pages/superMagic/components/Detail/contents/HTML/previewImageProcess"

// Mock the dependencies
vi.mock("@/pages/superMagic/components/Detail/contents/HTML/htmlProcessor")

describe("SlideProcessorService", () => {
	let service: SlideProcessorService

	const mockConfig = {
		attachments: [{ file_id: "file1", file_name: "test.html" }],
		attachmentList: [{ file_id: "file1", file_name: "test.html" }],
		mainFileId: "main-file-id",
		mainFileName: "main.html",
		displayConfig: { type: "ppt" },
		fileApi: {
			identityKey: "share:test",
			getTemporaryDownloadUrl: vi.fn(),
			getFileContentById: vi.fn(),
			getFileContentsByIds: vi.fn(),
			requestSharedMediaUrls: vi.fn(),
		},
	}

	beforeEach(() => {
		service = new SlideProcessorService(mockConfig)
		vi.clearAllMocks()
	})

	describe("processSlide", () => {
		it("should process slide content successfully", async () => {
			const rawContent = "<html><body>Raw Content</body></html>"
			const processedContent = "<html><body>Processed Content</body></html>"

			// Mock processHtmlContent
			vi.mocked(htmlProcessor.processHtmlContent).mockResolvedValue({
				processedContent,
				processedSlides: [],
				hasSlides: false,
				fileUrlMapping: new Map(),
				slidesFileIds: [],
				filePathMapping: new Map(),
				slidesMap: new Map(),
				originalSlidesPaths: [],
			})

			const result = await service.processSlide(rawContent, 0, "/slides/")

			expect(result.content).toBe(processedContent)
			expect(htmlProcessor.processHtmlContent).toHaveBeenCalledWith({
				content: rawContent,
				attachments: mockConfig.attachments,
				fileId: mockConfig.mainFileId,
				fileName: mockConfig.mainFileName, // Uses mainFileName from config
				attachmentList: mockConfig.attachmentList,
				html_relative_path: "/slides/",
				displayConfig: mockConfig.displayConfig,
				fileApi: mockConfig.fileApi,
				xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
				// metadata: mockConfig.metadata, // Not passed in processSlide method
			})
		})

		it("should return empty string for empty content", async () => {
			const result = await service.processSlide("", 0)

			expect(result.content).toBe("")
			expect(htmlProcessor.processHtmlContent).not.toHaveBeenCalled()
		})

		it("should return original content on processing error", async () => {
			const rawContent = "<html><body>Raw Content</body></html>"
			vi.mocked(htmlProcessor.processHtmlContent).mockRejectedValue(
				new Error("Processing failed"),
			)

			const result = await service.processSlide(rawContent, 0)

			expect(result.content).toBe(rawContent)
		})

		it("should use custom file name when provided in config", async () => {
			const customConfig = {
				...mockConfig,
				mainFileName: "custom.html",
			}
			const customService = new SlideProcessorService(customConfig)

			vi.mocked(htmlProcessor.processHtmlContent).mockResolvedValue({
				processedContent: "processed",
				processedSlides: [],
				hasSlides: false,
				fileUrlMapping: new Map(),
				slidesFileIds: [],
				filePathMapping: new Map(),
				slidesMap: new Map(),
				originalSlidesPaths: [],
			})

			await customService.processSlide("<html></html>", 5)

			expect(htmlProcessor.processHtmlContent).toHaveBeenCalledWith(
				expect.objectContaining({
					fileName: "custom.html",
				}),
			)
		})
	})

	describe("processSlideWithUrlMapping", () => {
		it("passes the bound file API with the preloaded URL mapping", async () => {
			vi.mocked(htmlProcessor.processHtmlContent).mockResolvedValue({
				processedContent: "processed",
				hasSlides: false,
				filePathMapping: new Map(),
				slidesMap: new Map(),
				originalSlidesPaths: [],
			})
			const urlMapping = new Map([["image-file", "https://oss.example.com/image.png"]])

			await service.processSlideWithUrlMapping(
				'<img src="image.png">',
				1,
				"deck/",
				urlMapping,
			)

			expect(htmlProcessor.processHtmlContent).toHaveBeenCalledWith(
				expect.objectContaining({
					fileApi: mockConfig.fileApi,
					preloadedUrlMapping: urlMapping,
					xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
				}),
			)
		})
	})

	describe("updateConfig", () => {
		it("should update service configuration", () => {
			const newAttachments = [{ file_id: "file2", file_name: "new.html" }]

			service.updateConfig({ attachments: newAttachments })

			// Verify config is updated by checking next processSlide call
			vi.mocked(htmlProcessor.processHtmlContent).mockResolvedValue({
				processedContent: "test",
				processedSlides: [],
				hasSlides: false,
				fileUrlMapping: new Map(),
				slidesFileIds: [],
				filePathMapping: new Map(),
				slidesMap: new Map(),
				originalSlidesPaths: [],
			})

			service.processSlide("<html></html>", 0)

			expect(htmlProcessor.processHtmlContent).toHaveBeenCalledWith(
				expect.objectContaining({
					attachments: newAttachments,
				}),
			)
		})
	})
})
