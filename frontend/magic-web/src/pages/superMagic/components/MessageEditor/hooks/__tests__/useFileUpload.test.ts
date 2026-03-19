import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { StrictMode, createElement, type ReactNode } from "react"
import { useFileUpload } from "../useFileUpload"
import { FileData } from "../../types"
import { message } from "antd"
import MentionPanelStore from "@/opensource/components/business/MentionPanel/store"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import projectFilesStore from "@/opensource/stores/projectFiles"

// Mock dependencies
vi.mock("antd", () => ({
	message: {
		error: vi.fn(),
		warning: vi.fn(),
	},
}))

vi.mock("@/opensource/apis/clients/magic", () => ({
	default: {
		post: vi.fn().mockResolvedValue({
			temporary_credential: {
				dir: "test-dir/",
			},
		}),
	},
}))

vi.mock("@/opensource/apis/core/HttpClient", () => ({
	HttpClient: vi.fn().mockImplementation(() => ({
		request: vi.fn().mockResolvedValue({
			data: {
				temporary_credential: {
					dir: "test-dir/",
				},
			},
		}),
		setupInterceptors: vi.fn(), // Add this method that MagicHttpClient expects
	})),
}))

vi.mock("react-i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react-i18next")>()
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string, options?: any) => {
				const translations: Record<string, string> = {
					"fileUpload.maxFilesReached": `Maximum ${options?.maxCount} files allowed`,
					"fileUpload.duplicateFilesFiltered": `${options?.count} duplicate files filtered`,
					"fileUpload.fileAlreadyExists": "File already exists",
					"fileUpload.fileReportFailed": "File report failed",
					"fileUpload.fileSizeExceeded": `The maximum size of a single file is ${options?.maxSize}MB, filtered out`,
					"fileUpload.uploadFailed": "Upload failed",
				}
				return translations[key] || key
			},
		}),
	}
})

vi.mock("@/opensource/hooks/useUploadFiles", () => ({
	useUpload: vi.fn(),
}))

vi.mock("@/opensource/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
}))

vi.mock("../../services/UploadTokenService", () => ({
	superMagicUploadTokenService: {
		getUploadTokenUrl: "https://test.com/upload",
		getUploadToken: vi.fn().mockImplementation((projectId: string) => {
			// Return a resolved promise immediately to avoid URL parsing issues
			console.log("getUploadToken called with projectId:", projectId)
			const result = {
				temporary_credential: {
					dir: "test-dir/",
				},
			}
			console.log("getUploadToken returning:", result)
			return Promise.resolve(result)
		}),
		saveFileToProject: vi.fn().mockResolvedValue({
			file_id: "saved-file-id",
			file_key: "test-dir/uploads/test.png",
			file_name: "test.png",
			file_size: 1024,
			file_type: "user_upload",
			project_id: "test-project",
			topic_id: "test-topic",
			task_id: "test-task",
			created_at: "2025-01-01T00:00:00Z",
			relative_file_path: "/uploads/test.png",
		}),
	},
}))

vi.mock("@/opensource/components/business/MentionPanel/store", () => {
	const mockStore = {
		workspaceFilesList: [] as any[],
		hasProjectFiles: vi.fn().mockReturnValue(false),
		getFileNamesInFolder: vi.fn().mockImplementation((folderPath: string) => {
			return mockStore.workspaceFilesList
				.filter((item: any) => {
					return item.file_key && item.file_key.startsWith(folderPath)
				})
				.map((file: any) => {
					// Extract filename from file_key (get the last part after the last slash)
					const lastSlashIndex = file.file_key.lastIndexOf("/")
					return lastSlashIndex !== -1
						? file.file_key.slice(lastSlashIndex + 1)
						: file.file_key
				})
		}),
	}

	return {
		default: mockStore,
	}
})

// Helper function to create mock File objects
function createMockFile(
	name: string,
	size: number = 1024,
	lastModified: number = Date.now(),
	type: string = "image/png",
): File {
	const file = new File(["x"], name, {
		type,
		lastModified,
	})

	// Override the size property to match the expected size
	Object.defineProperty(file, "size", {
		value: size,
		writable: false,
		enumerable: true,
		configurable: false,
	})

	return file
}

// Helper function to create mock FileData objects
function createMockFileData(
	name: string,
	id: string = "test-id",
	suffixDir: string = "uploads",
): FileData {
	return {
		id,
		name,
		file: createMockFile(name),
		status: "init",
		suffixDir,
	}
}

// Helper to get mocked store
function getMockedStore() {
	return vi.mocked(MentionPanelStore)
}

describe("useFileUpload", () => {
	beforeEach(() => {
		vi.clearAllMocks()

		vi.mocked(useUpload).mockReturnValue({
			upload: vi.fn().mockResolvedValue({ fullfilled: [], rejected: [] }),
			uploading: false,
			uploadAndGetFileUrl: vi.fn(),
			reportFiles: vi.fn().mockResolvedValue([
				{
					file_id: "test-file-id",
					file_name: "test.png",
					file_size: 1024,
					file_key: "test-dir/uploads/test.png",
				},
			]),
		} as any)

		projectFilesStore.setSelectedProject(null)
		projectFilesStore.setWorkspaceFileTree([])
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Basic functionality", () => {
		it("should initialize with empty files array", () => {
			const { result } = renderHook(() => useFileUpload())

			expect(result.current.files).toEqual([])
			expect(result.current.uploading).toBe(false)
			expect(result.current.isAllFilesUploaded).toBe(true)
		})

		it("should provide all necessary methods", () => {
			const { result } = renderHook(() => useFileUpload())

			expect(typeof result.current.addFiles).toBe("function")
			expect(typeof result.current.removeFile).toBe("function")
			expect(typeof result.current.clearFiles).toBe("function")
		})

		it("should call onFileUpload callback when files are updated", async () => {
			const onFileUpload = vi.fn()
			const { result } = renderHook(() => useFileUpload({ onFileUpload }))

			const testFile = createMockFile("test.png")

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(onFileUpload).toHaveBeenCalled()
			})
		})
	})

	describe("File limit functionality", () => {
		it("should limit files to maxUploadCount", async () => {
			const { result } = renderHook(() => useFileUpload({ maxUploadCount: 2 }))

			const testFiles = [
				createMockFile("file1.png"),
				createMockFile("file2.png"),
				createMockFile("file3.png"),
			]

			await act(async () => {
				await result.current.addFiles(testFiles)
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
				expect(message.error).toHaveBeenCalledWith("Maximum 2 files allowed")
			})
		})
	})

	describe("File size validation", () => {
		it("should keep media files under media limit even when exceeding default limit", () => {
			const { result } = renderHook(() =>
				useFileUpload({
					maxUploadSize: 100,
					maxMediaUploadSize: 500,
				}),
			)

			const oversizedImage = createMockFile("image.png", 120, Date.now(), "image/png")
			const validAudio = createMockFile("voice.mp3", 400, Date.now(), "audio/mpeg")

			const validation = result.current.validateFileSize([oversizedImage, validAudio])
			expect(validation.validFiles).toHaveLength(1)
			expect(validation.validFiles[0].name).toBe("voice.mp3")
		})

		it("should filter media files exceeding configurable media limit", () => {
			const { result } = renderHook(() =>
				useFileUpload({
					maxUploadSize: 100,
					maxMediaUploadSize: 300,
				}),
			)

			const oversizedAudio = createMockFile("voice.mp3", 400, Date.now(), "audio/mpeg")
			const oversizedVideo = createMockFile("demo.mp4", 400, Date.now(), "video/mp4")

			const validation = result.current.validateFileSize([oversizedAudio, oversizedVideo])
			expect(validation.validFiles).toHaveLength(0)
			expect(validation.hasWarning).toBe(true)
		})

		it("should identify media files by extension when MIME type is missing", () => {
			const { result } = renderHook(() =>
				useFileUpload({
					maxUploadSize: 100,
					maxMediaUploadSize: 500,
				}),
			)

			const extensionOnlyMedia = createMockFile("voice.m4a", 400, Date.now(), "")
			const validation = result.current.validateFileSize([extensionOnlyMedia])

			expect(validation.validFiles).toHaveLength(1)
			expect(validation.hasWarning).toBe(false)
		})
	})

	describe("Optimistic attachment update", () => {
		it("should optimistically add saved file into projectFilesStore list", async () => {
			projectFilesStore.setSelectedProject({ id: "test-project" } as any)
			projectFilesStore.setWorkspaceFileTree([])

			let capturedParams: any
			const uploadMock = vi.fn().mockImplementation(async (fileList: any[]) => {
				const f = fileList[0]
				await capturedParams?.onSuccess?.(f, {
					key: "test-dir/uploads/test.png",
					name: "test.png",
					size: f.file?.size ?? 1024,
				})
				return { fullfilled: [], rejected: [] }
			})

			vi.mocked(useUpload).mockImplementation((params: any) => {
				capturedParams = params
				return {
					upload: uploadMock,
					uploading: false,
					uploadAndGetFileUrl: vi.fn(),
					reportFiles: vi.fn().mockResolvedValue([
						{
							file_id: "test-file-id",
							file_name: "test.png",
							file_size: 1024,
							file_key: "test-dir/uploads/test.png",
						},
					]),
				}
			})

			const { result } = renderHook(() =>
				useFileUpload({ projectId: "test-project", topicId: "test-topic" }),
			)

			const testFile = createMockFile("test.png", 1024, 1234567890)

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(
					projectFilesStore.workspaceFilesList.some(
						(f: any) => f.file_id === "saved-file-id",
					),
				).toBe(true)
			})
		})
	})

	describe("Duplicate file filtering", () => {
		it("should filter out duplicate files based on name, size, and lastModified", async () => {
			const { result } = renderHook(() => useFileUpload())

			const originalFile = createMockFile("test.png", 1024, 1234567890)
			const duplicateFile = createMockFile("test.png", 1024, 1234567890)
			const differentFile = createMockFile("test.png", 2048, 1234567890) // Different size

			// Add original file first
			await act(async () => {
				await result.current.addFiles([originalFile])
			})

			// Try to add duplicate and different files
			await act(async () => {
				await result.current.addFiles([duplicateFile, differentFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2) // Original + different file
				expect(message.warning).toHaveBeenCalledWith("1 duplicate files filtered")
			})
		})

		it("should allow same file to be uploaded to different directories", async () => {
			const { result } = renderHook(() => useFileUpload())

			const file1 = createMockFile("test.png", 1024, 1234567890)
			const file2 = createMockFile("test.png", 1024, 1234567890) // Same file

			// Add file to default directory (uploads)
			await act(async () => {
				await result.current.addFiles([file1])
			})

			// Add same file to different directory
			await act(async () => {
				await result.current.addFiles([file2], "documents")
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2) // Both files should be added
				expect(result.current.files[0].suffixDir).toBe("uploads")
				expect(result.current.files[1].suffixDir).toBe("documents")
			})
		})

		it("should keep original filename when uploading to different directories", async () => {
			const { result } = renderHook(() => useFileUpload())

			const file1 = createMockFile("document.pdf", 1024, 1234567890)
			const file2 = createMockFile("document.pdf", 1024, 1234567890) // Same file

			// Add file to uploads directory
			await act(async () => {
				await result.current.addFiles([file1], "uploads")
			})

			// Add same file to documents directory - should keep original name
			await act(async () => {
				await result.current.addFiles([file2], "documents")
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
				expect(result.current.files[0].name).toBe("document.pdf") // Original name
				expect(result.current.files[1].name).toBe("document.pdf") // Also original name
				expect(result.current.files[0].suffixDir).toBe("uploads")
				expect(result.current.files[1].suffixDir).toBe("documents")
			})
		})

		it("should rename files when uploading to same directory", async () => {
			const { result } = renderHook(() => useFileUpload())

			const file1 = createMockFile("document.pdf", 1024, 1234567890)
			const file2 = createMockFile("document.pdf", 1024, 1234567891) // Different lastModified to avoid duplicate filter

			// Add file to uploads directory
			await act(async () => {
				await result.current.addFiles([file1], "uploads")
			})

			// Add file with same name to same directory - should be renamed
			await act(async () => {
				await result.current.addFiles([file2], "uploads")
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
				expect(result.current.files[0].name).toBe("document.pdf") // Original name
				expect(result.current.files[1].name).toBe("document (1).pdf") // Renamed
				expect(result.current.files[0].suffixDir).toBe("uploads")
				expect(result.current.files[1].suffixDir).toBe("uploads")
			})
		})
	})

	describe("File removal", () => {
		it("should remove file by id", async () => {
			const { result } = renderHook(() => useFileUpload())

			const testFile = createMockFile("test.png")

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
			})

			const fileId = result.current.files[0].id

			act(() => {
				result.current.removeFile(fileId)
			})

			expect(result.current.files).toHaveLength(0)
		})

		it("should call onFileRemoved callback when file is removed", async () => {
			const onFileRemoved = vi.fn()
			const { result } = renderHook(() => useFileUpload({ onFileRemoved }))

			const testFile = createMockFile("test.png")

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
			})

			const fileId = result.current.files[0].id

			act(() => {
				result.current.removeFile(fileId)
			})

			expect(onFileRemoved).toHaveBeenCalledWith(fileId)
		})
	})

	describe("Clear files", () => {
		it("should clear all files", async () => {
			const { result } = renderHook(() => useFileUpload())

			const testFiles = [createMockFile("file1.png"), createMockFile("file2.png")]

			await act(async () => {
				await result.current.addFiles(testFiles)
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
			})

			act(() => {
				result.current.clearFiles()
			})

			expect(result.current.files).toHaveLength(0)
		})
	})

	describe("isAllFilesUploaded", () => {
		it("should return true when no files", () => {
			const { result } = renderHook(() => useFileUpload())

			expect(result.current.isAllFilesUploaded).toBe(true)
		})

		it("should return false when files are not all uploaded", async () => {
			const { result } = renderHook(() => useFileUpload())

			const testFile = createMockFile("test.png")

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(result.current.isAllFilesUploaded).toBe(false)
			})
		})
	})

	describe("Callback functions", () => {
		it("should call onFileAdded when files are added", async () => {
			const onFileAdded = vi.fn()
			const wrapper = ({ children }: { children: ReactNode }) =>
				createElement(StrictMode, null, children)
			const { result } = renderHook(() => useFileUpload({ onFileAdded }), { wrapper })

			const testFile = createMockFile("test.png")

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(onFileAdded).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							name: "test.png",
							status: "init",
						}),
					]),
				)
			})

			expect(onFileAdded).toHaveBeenCalledTimes(1)
		})

		it("should call onFileProgressUpdate during upload", async () => {
			const onFileProgressUpdate = vi.fn()
			const { result } = renderHook(() => useFileUpload({ onFileProgressUpdate }))

			const testFile = createMockFile("test.png")

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			// Wait for initial add
			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
			})

			// Note: Testing upload progress would require mocking the upload hook more thoroughly
			// This is a placeholder for more detailed upload testing
		})
	})
})

describe("generateUniqueFileName", () => {
	// Since generateUniqueFileName is not exported, we'll test it through the hook behavior
	describe("File renaming logic", () => {
		it("should rename files that conflict with existing files", async () => {
			const { result } = renderHook(() => useFileUpload())

			// Add first file
			const firstFile = createMockFile("image.png")
			await act(async () => {
				await result.current.addFiles([firstFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
				expect(result.current.files[0].name).toBe("image.png")
			})

			// Add second file with same name
			const secondFile = createMockFile("image.png", 2048) // Different size to avoid duplicate filter
			await act(async () => {
				await result.current.addFiles([secondFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
				expect(result.current.files[1].name).toBe("image (1).png")
			})
		})

		it("should handle multiple files with same name", async () => {
			const { result } = renderHook(() => useFileUpload())

			// Add multiple files with same name but different sizes
			const files = [
				createMockFile("document.pdf", 1024),
				createMockFile("document.pdf", 2048),
				createMockFile("document.pdf", 3072),
			]

			await act(async () => {
				await result.current.addFiles(files)
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(3)
				expect(result.current.files[0].name).toBe("document.pdf")
				expect(result.current.files[1].name).toBe("document (1).pdf")
				expect(result.current.files[2].name).toBe("document (2).pdf")
			})
		})

		it("should handle files without extensions", async () => {
			const { result } = renderHook(() => useFileUpload())

			const files = [createMockFile("README", 1024), createMockFile("README", 2048)]

			await act(async () => {
				await result.current.addFiles(files)
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
				expect(result.current.files[0].name).toBe("README")
				expect(result.current.files[1].name).toBe("README (1)")
			})
		})

		it("should handle complex file names with multiple dots", async () => {
			const { result } = renderHook(() => useFileUpload())

			const files = [
				createMockFile("file.backup.tar.gz", 1024),
				createMockFile("file.backup.tar.gz", 2048),
			]

			await act(async () => {
				await result.current.addFiles(files)
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
				expect(result.current.files[0].name).toBe("file.backup.tar.gz")
				expect(result.current.files[1].name).toBe("file.backup.tar (1).gz")
			})
		})

		it("should continue numbering correctly when files are removed", async () => {
			const { result } = renderHook(() => useFileUpload())

			// Add two files with same name
			const files = [createMockFile("test.txt", 1024), createMockFile("test.txt", 2048)]

			await act(async () => {
				await result.current.addFiles(files)
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
			})

			// Remove the second file
			act(() => {
				result.current.removeFile(result.current.files[1].id)
			})

			expect(result.current.files).toHaveLength(1)

			// Add another file with same name
			const thirdFile = createMockFile("test.txt", 3072)
			await act(async () => {
				await result.current.addFiles([thirdFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
				expect(result.current.files[1].name).toBe("test (1).txt")
			})
		})
	})

	describe("Project file conflict scenarios", () => {
		beforeEach(() => {
			// Mock project files in the store (projectFilesStore is used for renaming checks)
			projectFilesStore.setWorkspaceFileTree([
				{
					type: "file",
					file_key: "test-dir/uploads/existing-file.png",
					file_name: "existing-file.png",
					file_size: 1024,
					file_id: "file-1",
					task_id: "task-1",
					project_id: "project-1",
					children: [],
					file_type: "user_upload",
					file_extension: "png",
					thumbnail_url: "",
					file_url: "",
					created_at: "2023-01-01T00:00:00Z",
					updated_at: "2023-01-01T00:00:00Z",
				} as any,
				{
					type: "file",
					file_key: "test-dir/uploads/document.pdf",
					file_name: "document.pdf",
					file_size: 2048,
					file_id: "file-2",
					task_id: "task-1",
					project_id: "project-1",
					children: [],
					file_type: "user_upload",
					file_extension: "pdf",
					thumbnail_url: "",
					file_url: "",
					created_at: "2023-01-01T00:00:00Z",
					updated_at: "2023-01-01T00:00:00Z",
				} as any,
				{
					type: "file",
					file_key: "test-dir/uploads/image (1).png",
					file_name: "image (1).png",
					file_size: 3072,
					file_id: "file-3",
					task_id: "task-1",
					project_id: "project-1",
					children: [],
					file_type: "user_upload",
					file_extension: "png",
					thumbnail_url: "",
					file_url: "",
					created_at: "2023-01-01T00:00:00Z",
					updated_at: "2023-01-01T00:00:00Z",
				} as any,
			] as any[])
		})

		it("should rename files that conflict with project files", async () => {
			const { result } = renderHook(() => useFileUpload({ projectId: "test-project" }))

			// Try to add file that conflicts with project file
			const conflictFile = createMockFile("existing-file.png", 1024)

			await act(async () => {
				await result.current.addFiles([conflictFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
				expect(result.current.files[0].name).toBe("existing-file (1).png")
			})
		})

		it("should handle two-step renaming: first avoid upload queue conflicts, then project file conflicts", async () => {
			const { result } = renderHook(() => useFileUpload({ projectId: "test-project" }))

			// First add a file to upload queue
			const queueFile = createMockFile("image.png", 1024)
			await act(async () => {
				await result.current.addFiles([queueFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
				expect(result.current.files[0].name).toBe("image.png")
			})

			// Now try to add another file with same name
			// It should be renamed to "image (1).png", but that conflicts with project file
			// So it should be renamed to "image (2).png"
			const conflictFile = createMockFile("image.png", 2048)
			await act(async () => {
				await result.current.addFiles([conflictFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(2)
				expect(result.current.files[1].name).toBe("image (2).png")
			})
		})

		it("should handle complex multi-step renaming scenarios", async () => {
			const { result } = renderHook(() => useFileUpload({ projectId: "test-project" }))

			// Add multiple files with same base name that conflict with both queue and project
			const files = [
				createMockFile("document.pdf", 1024), // Will be renamed to document (1).pdf due to project conflict
				createMockFile("document.pdf", 2048), // Will be renamed to document (2).pdf
				createMockFile("document.pdf", 3072), // Will be renamed to document (3).pdf
			]

			await act(async () => {
				await result.current.addFiles(files)
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(3)
				expect(result.current.files[0].name).toBe("document (1).pdf") // Original conflicts with project
				expect(result.current.files[1].name).toBe("document (2).pdf") // Conflicts with first renamed file
				expect(result.current.files[2].name).toBe("document (3).pdf") // Conflicts with second renamed file
			})
		})

		it("should handle files without project context", async () => {
			const { result } = renderHook(() => useFileUpload()) // No projectId

			const testFile = createMockFile("existing-file.png", 1024)

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
				// Should not be renamed since no project context
				expect(result.current.files[0].name).toBe("existing-file.png")
			})
		})

		it("should handle empty project files list", async () => {
			// Mock empty project files
			projectFilesStore.setWorkspaceFileTree([])

			const { result } = renderHook(() => useFileUpload({ projectId: "test-project" }))

			const testFile = createMockFile("test-file.png", 1024)

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
				expect(result.current.files[0].name).toBe("test-file.png")
			})
		})

		it("should handle project folders mixed with files", async () => {
			// Mock project files with folders
			projectFilesStore.setWorkspaceFileTree([
				{
					type: "directory",
					folder_id: "folder-1",
					folder_name: "Documents",
					children: [],
					project_id: "project-1",
					created_at: "2023-01-01T00:00:00Z",
					updated_at: "2023-01-01T00:00:00Z",
				} as any,
				{
					type: "file",
					file_key: "test-dir/uploads/report.pdf",
					file_name: "report.pdf",
					file_size: 1024,
					file_id: "file-4",
					task_id: "task-1",
					project_id: "project-1",
					children: [],
					file_type: "user_upload",
					file_extension: "pdf",
					thumbnail_url: "",
					file_url: "",
					created_at: "2023-01-01T00:00:00Z",
					updated_at: "2023-01-01T00:00:00Z",
				} as any,
			] as any[])

			const { result } = renderHook(() => useFileUpload({ projectId: "test-project" }))

			const testFile = createMockFile("report.pdf", 1024)

			await act(async () => {
				await result.current.addFiles([testFile])
			})

			await waitFor(() => {
				expect(result.current.files).toHaveLength(1)
				expect(result.current.files[0].name).toBe("report (1).pdf")
			})
		})
	})
})
