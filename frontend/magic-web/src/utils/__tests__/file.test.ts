import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
// @ts-ignore
import { downloadFile, getFileExtension } from "../file"

// Mock the i18next module
vi.mock("i18next", () => ({
	t: vi.fn((key: string) => key),
}))

// Mock global fetch
global.fetch = vi.fn()

// Mock file-type module
vi.mock("file-type", () => ({
	fileTypeFromStream: vi.fn(),
}))

// Mock IMAGE_EXTENSIONS constant
vi.mock("@/const/file", () => ({
	IMAGE_EXTENSIONS: ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"],
}))

// Type helper for mocking FileTypeResult
const createMockFileType = (ext: string, mime: string) => ({ ext, mime } as any)

// Helper functions that are not exported but need to be tested
// We'll access them through the downloadFile function behavior

describe("file utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Mock DOM elements
		document.createElement = vi.fn().mockImplementation((tagName: string) => {
			if (tagName === "a") {
				return {
					href: "",
					download: "",
					click: vi.fn(),
					remove: vi.fn(),
				}
			}
			return {}
		})
		document.body.appendChild = vi.fn()
		document.body.removeChild = vi.fn()
		window.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url")
		window.URL.revokeObjectURL = vi.fn()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("hasFileExtension (tested through downloadFile behavior)", () => {
		it("should identify filenames with extensions", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("pdf", "application/pdf"),
			)

			const result = await downloadFile("http://example.com/file.pdf", "document.pdf")

			expect(result.success).toBe(true)
			expect(document.createElement).toHaveBeenCalledWith("a")
		})

		it("should identify filenames without extensions", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("pdf", "application/pdf"),
			)

			const result = await downloadFile("http://example.com/file.pdf", "document")

			expect(result.success).toBe(true)
			// The filename should be enhanced with extension internally
		})

		it("should handle filenames with dots in directory paths", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(createMockFileType("txt", "text/plain"))

			const result = await downloadFile(
				"http://example.com/file.txt",
				"/path/with.dots/filename",
			)

			expect(result.success).toBe(true)
		})
	})

	describe("ensureFileExtension (tested through downloadFile behavior)", () => {
		it("should preserve filename with existing extension", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("pdf", "application/pdf"),
			)

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			await downloadFile("http://example.com/file.pdf", "document.pdf")

			expect(mockLink.download).toBe(encodeURIComponent("document.pdf"))
		})

		it("should add extension to filename without extension", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("pdf", "application/pdf"),
			)

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			await downloadFile("http://example.com/file.pdf", "document")

			expect(mockLink.download).toBe(encodeURIComponent("document.pdf"))
		})

		it("should handle extension with and without dots", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(createMockFileType("txt", "text/plain"))

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			await downloadFile("http://example.com/file.txt", "document", "txt")

			expect(mockLink.download).toBe(encodeURIComponent("document.txt"))
		})

		it("should return original filename if empty", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("pdf", "application/pdf"),
			)

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			await downloadFile("http://example.com/file.pdf", "")

			expect(mockLink.download).toBe(encodeURIComponent("download.pdf"))
		})
	})

	describe("downloadFile", () => {
		it("should return error when url is not provided", async () => {
			const result = await downloadFile()
			expect(result.success).toBe(false)
			expect(result.message).toBe("FileNotFound")
		})

		it("should return error when url is empty", async () => {
			const result = await downloadFile("")
			expect(result.success).toBe(false)
			expect(result.message).toBe("FileNotFound")
		})

		it("should handle blob URLs correctly", async () => {
			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			const result = await downloadFile("blob:http://example.com/123-456", "document.pdf")

			expect(result.success).toBe(true)
			expect(mockLink.href).toBe("blob:http://example.com/123-456")
			expect(mockLink.download).toBe(encodeURIComponent("document.pdf"))
			expect(mockLink.click).toHaveBeenCalled()
		})

		it("should handle blob URLs with filename without extension", async () => {
			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("pdf", "application/pdf"),
			)

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			const result = await downloadFile("blob:http://example.com/123-456", "document", "pdf")

			expect(result.success).toBe(true)
			expect(mockLink.download).toBe(encodeURIComponent("document.pdf"))
		})

		it("should handle image files with fetch", async () => {
			const mockBlob = new Blob(["fake image data"], { type: "image/jpeg" })
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				blob: () => Promise.resolve(mockBlob),
				body: new ReadableStream(),
				ok: true,
			} as any)
			// Second fetch call for image download
			mockFetch.mockResolvedValueOnce({
				blob: () => Promise.resolve(mockBlob),
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(createMockFileType("jpg", "image/jpeg"))

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			const result = await downloadFile("http://example.com/image.jpg", "photo")

			expect(result.success).toBe(true)
			expect(mockLink.download).toBe(encodeURIComponent("photo.jpg"))
			expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
			expect(window.URL.revokeObjectURL).toHaveBeenCalled()
		})

		it("should handle SVG files specially", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("svg", "image/svg+xml"),
			)

			global.File = vi.fn().mockImplementation((chunks, filename, options) => ({
				chunks,
				filename,
				options,
			})) as any

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			const result = await downloadFile("http://example.com/image.svg", "icon")

			expect(result.success).toBe(true)
			expect(mockLink.download).toBe(encodeURIComponent("icon.svg"))
		})

		it("should handle non-image files with direct link", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("pdf", "application/pdf"),
			)

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			const result = await downloadFile("http://example.com/document.pdf", "myfile")

			expect(result.success).toBe(true)
			expect(mockLink.href).toBe("http://example.com/document.pdf")
			expect(mockLink.download).toBe(encodeURIComponent("myfile.pdf"))
			expect(mockLink.click).toHaveBeenCalled()
		})

		it("should use provided extension parameter", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			const result = await downloadFile("http://example.com/file", "document", "docx")

			expect(result.success).toBe(true)
			expect(mockLink.download).toBe(encodeURIComponent("document.docx"))
		})

		it("should use default filename when name is not provided", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(createMockFileType("txt", "text/plain"))

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			const result = await downloadFile("http://example.com/file.txt")

			expect(result.success).toBe(true)
			expect(mockLink.download).toBe(encodeURIComponent("download.txt"))
		})

		it("should handle errors gracefully", async () => {
			const mockFetch = vi.mocked(fetch)
			// First call for getFileExtension - this will succeed
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(
				createMockFileType("pdf", "application/pdf"),
			)

			// Create a mock link that will throw error
			const createElementSpy = vi.spyOn(document, "createElement")
			createElementSpy.mockImplementation(() => {
				throw new Error("DOM error")
			})

			const result = await downloadFile("http://example.com/file.pdf", "document")

			expect(result.success).toBe(false)
			expect(result.message).toBe("DownloadFailed")
		})

		it("should handle getFileExtension returning undefined", async () => {
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			vi.mocked(fileTypeFromStream).mockResolvedValue(undefined)

			const createElementSpy = vi.spyOn(document, "createElement")
			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
				remove: vi.fn(),
			}
			createElementSpy.mockReturnValue(mockLink as any)

			const result = await downloadFile("http://example.com/file", "document")

			expect(result.success).toBe(true)
			expect(mockLink.download).toBe(encodeURIComponent("document"))
		})
	})

	describe("getFileExtension", () => {
		it("should return cached result for same URL", async () => {
			// Clear the cache first to ensure a clean state
			const url = "http://example.com/new-file.pdf"

			const mockFetch = vi.mocked(fetch)
			mockFetch.mockResolvedValueOnce({
				body: new ReadableStream(),
				ok: true,
			} as any)

			const { fileTypeFromStream } = await import("file-type")
			const mockFileType = createMockFileType("pdf", "application/pdf")
			vi.mocked(fileTypeFromStream).mockResolvedValue(mockFileType)

			// First call
			const result1 = await getFileExtension(url)
			expect(result1).toEqual(mockFileType)

			// Second call should use cache
			const result2 = await getFileExtension(url)
			expect(result2).toEqual(mockFileType)

			// fetch should only be called once due to caching
			expect(mockFetch).toHaveBeenCalledTimes(1)
		})

		it("should return undefined for invalid URL", async () => {
			const result = await getFileExtension(undefined)
			expect(result).toBeUndefined()
		})

		it("should handle fetch errors gracefully", async () => {
			const url = "http://example.com/error-file.pdf"
			const mockFetch = vi.mocked(fetch)
			mockFetch.mockRejectedValueOnce(new Error("Network error"))

			const result = await getFileExtension(url)
			expect(result).toBeUndefined()
		})

		it("should handle File objects", async () => {
			const mockFile = new File(["content"], "test.pdf", { type: "application/pdf" })
			mockFile.stream = vi.fn().mockReturnValue(new ReadableStream())

			const { fileTypeFromStream } = await import("file-type")
			const mockFileType = createMockFileType("pdf", "application/pdf")
			vi.mocked(fileTypeFromStream).mockResolvedValue(mockFileType)

			const result = await getFileExtension(mockFile)
			expect(result).toEqual(mockFileType)
			expect(mockFile.stream).toHaveBeenCalled()
		})
	})
})
