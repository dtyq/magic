import { describe, it, expect, vi, beforeEach } from "vitest"
import { KnowledgeApi } from "@/apis"
import {
	createLocalDocument,
	createCustomDocument,
	createLocalDocumentsBatch,
} from "../documentCreator"
import type { CreateLocalDocumentParams, CreateCustomDocumentParams } from "../documentCreator"

// Mock KnowledgeApi
vi.mock("@/apis", () => ({
	KnowledgeApi: {
		addKnowledgeDocument: vi.fn(),
		getTemporaryCredential: vi.fn(),
		uploadFile: vi.fn(),
	},
}))

// Mock magicToast
vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: vi.fn(),
		success: vi.fn(),
	},
}))

describe("documentCreator", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("createLocalDocument", () => {
		it("should create local document successfully", async () => {
			const mockResult = {
				code: "DOC-001",
				name: "test.pdf",
				sync_status: 0,
			}

			vi.mocked(KnowledgeApi.addKnowledgeDocument).mockResolvedValue(mockResult as any)

			const params: CreateLocalDocumentParams = {
				knowledgeCode: "KB-001",
				fileName: "test.pdf",
				fileKey: "path/to/test.pdf",
			}

			const result = await createLocalDocument(params)

			expect(KnowledgeApi.addKnowledgeDocument).toHaveBeenCalledWith({
				knowledge_code: "KB-001",
				name: "test.pdf",
				enabled: true,
				doc_type: 1,
				doc_metadata: {
					source: "knowledge-demo",
					source_type: "local_upload",
				},
				fragment_config: { mode: 2 },
				document_file: {
					name: "test.pdf",
					key: "path/to/test.pdf",
					type: 1,
				},
			})

			expect(result).toEqual(mockResult)
		})

		it("should use custom fragment config if provided", async () => {
			vi.mocked(KnowledgeApi.addKnowledgeDocument).mockResolvedValue({} as any)

			const customFragmentConfig = {
				mode: 1,
				normal: {
					text_preprocess_rule: [1, 2],
					segment_rule: {
						separator: "\\n",
						chunk_size: 500,
						chunk_overlap: 50,
					},
				},
			}

			await createLocalDocument({
				knowledgeCode: "KB-001",
				fileName: "test.pdf",
				fileKey: "path/to/test.pdf",
				fragmentConfig: customFragmentConfig as any,
			})

			expect(KnowledgeApi.addKnowledgeDocument).toHaveBeenCalledWith(
				expect.objectContaining({
					fragment_config: customFragmentConfig,
				}),
			)
		})
	})

	describe("createCustomDocument", () => {
		it("should create custom document successfully", async () => {
			const mockCredential = {
				temporary_credential: {
					host: "https://example.com",
					dir: "temp/dir",
					credentials: {
						AccessKeyId: "ak",
						SecretAccessKey: "sk",
						SessionToken: "token",
					},
				},
			}

			const mockUploadResult = {
				key: "temp/dir/123-test.md",
				path: "temp/dir/123-test.md",
			}

			const mockDocResult = {
				code: "DOC-002",
				name: "test",
				sync_status: 0,
			}

			vi.mocked(KnowledgeApi.getTemporaryCredential).mockResolvedValue(mockCredential as any)
			vi.mocked(KnowledgeApi.uploadFile).mockResolvedValue(mockUploadResult as any)
			vi.mocked(KnowledgeApi.addKnowledgeDocument).mockResolvedValue(mockDocResult as any)

			const params: CreateCustomDocumentParams = {
				knowledgeCode: "KB-001",
				name: "test",
				content: "# Test Content",
			}

			const result = await createCustomDocument(params)

			expect(KnowledgeApi.getTemporaryCredential).toHaveBeenCalledWith({
				storage: "private",
				sts: true,
				content_type: "text/markdown",
			})

			expect(KnowledgeApi.uploadFile).toHaveBeenCalled()

			expect(KnowledgeApi.addKnowledgeDocument).toHaveBeenCalledWith(
				expect.objectContaining({
					knowledge_code: "KB-001",
					name: "test",
					doc_metadata: {
						source: "knowledge-demo",
						source_type: "custom",
					},
				}),
			)

			expect(result).toEqual(mockDocResult)
		})
	})

	describe("createLocalDocumentsBatch", () => {
		it("should create multiple documents successfully", async () => {
			const mockResult1 = { code: "DOC-001", name: "file1.pdf" }
			const mockResult2 = { code: "DOC-002", name: "file2.pdf" }

			vi.mocked(KnowledgeApi.addKnowledgeDocument)
				.mockResolvedValueOnce(mockResult1 as any)
				.mockResolvedValueOnce(mockResult2 as any)

			const files = [
				{ fileId: "file-1", fileName: "file1.pdf", fileKey: "path/file1.pdf" },
				{ fileId: "file-2", fileName: "file2.pdf", fileKey: "path/file2.pdf" },
			]

			const result = await createLocalDocumentsBatch("KB-001", files)

			expect(result.succeeded).toHaveLength(2)
			expect(result.failed).toHaveLength(0)
			expect(result.succeeded[0]).toEqual({
				fileId: "file-1",
				document: mockResult1,
			})
			expect(result.succeeded[1]).toEqual({
				fileId: "file-2",
				document: mockResult2,
			})
		})

		it("should handle partial failures", async () => {
			const mockResult = { code: "DOC-001", name: "file1.pdf" }
			const mockError = new Error("Upload failed")

			vi.mocked(KnowledgeApi.addKnowledgeDocument)
				.mockResolvedValueOnce(mockResult as any)
				.mockRejectedValueOnce(mockError)

			const files = [
				{ fileId: "file-1", fileName: "file1.pdf", fileKey: "path/file1.pdf" },
				{ fileId: "file-2", fileName: "file2.pdf", fileKey: "path/file2.pdf" },
			]

			const result = await createLocalDocumentsBatch("KB-001", files)

			expect(result.succeeded).toHaveLength(1)
			expect(result.failed).toHaveLength(1)
			expect(result.succeeded[0]?.fileId).toBe("file-1")
			expect(result.failed[0].fileId).toBe("file-2")
			expect(result.failed[0].fileName).toBe("file2.pdf")
		})

		it("should keep duplicate file names distinguishable by fileId", async () => {
			const mockResult1 = { code: "DOC-001", name: "duplicate.pdf" }
			const mockResult2 = { code: "DOC-002", name: "duplicate.pdf" }

			vi.mocked(KnowledgeApi.addKnowledgeDocument)
				.mockResolvedValueOnce(mockResult1 as any)
				.mockResolvedValueOnce(mockResult2 as any)

			const files = [
				{ fileId: "file-1", fileName: "duplicate.pdf", fileKey: "path/duplicate-1.pdf" },
				{ fileId: "file-2", fileName: "duplicate.pdf", fileKey: "path/duplicate-2.pdf" },
			]

			const result = await createLocalDocumentsBatch("KB-001", files)

			expect(result.succeeded).toEqual([
				{
					fileId: "file-1",
					document: mockResult1,
				},
				{
					fileId: "file-2",
					document: mockResult2,
				},
			])
		})
	})
})
