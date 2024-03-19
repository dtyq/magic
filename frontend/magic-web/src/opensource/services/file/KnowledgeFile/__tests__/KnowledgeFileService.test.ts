import { vi, describe, it, expect, beforeEach } from "vitest"
import KnowledgeFileService from "../KnowledgeFileService"
import { FileApi } from "@/apis"

// Mock FileApi
vi.mock("@/apis", () => ({
	FileApi: {
		getKnowledgeFileUrl: vi.fn(),
	},
}))

// Mock KnowledgeFileDbService
vi.mock("../KnowledgeFileDbService", () => ({
	default: {
		initTable: vi.fn().mockResolvedValue(undefined),
		getAllFileCaches: vi.fn().mockResolvedValue([]),
		saveFileCache: vi.fn().mockResolvedValue(undefined),
		deleteExpiredCaches: vi.fn().mockResolvedValue(0),
		clearAllCaches: vi.fn().mockResolvedValue(undefined),
		getCacheStats: vi.fn().mockResolvedValue({
			total: 0,
			valid: 0,
			expired: 0,
		}),
	},
}))

describe("KnowledgeFileService", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// 清空内存缓存
		KnowledgeFileService.fileInfoCache.clear()
		// 清空正在进行的请求
		KnowledgeFileService["pendingRequests"].clear()
	})

	describe("fetchFileUrl", () => {
		it("should return null for empty fileKey", async () => {
			const result = await KnowledgeFileService.fetchFileUrl("")
			expect(result).toBeNull()
		})

		it("should fetch file URL from API when not cached", async () => {
			const mockFileKey = "test_file_key"
			const mockResponse = {
				url: "https://example.com/file.jpg",
				expires: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
				name: "test.jpg",
				uid: "test_uid",
				key: "test_key",
			}

			vi.mocked(FileApi.getKnowledgeFileUrl).mockResolvedValue(mockResponse)

			const result = await KnowledgeFileService.fetchFileUrl(mockFileKey)

			expect(FileApi.getKnowledgeFileUrl).toHaveBeenCalledWith(mockFileKey)
			expect(result).toEqual({
				...mockResponse,
				file_key: mockFileKey,
				cached_at: expect.any(Number),
			})
		})

		it("should return cached data when not expired", async () => {
			const mockFileKey = "test_file_key"
			const cachedData = {
				url: "https://example.com/cached.jpg",
				expires: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
				name: "cached.jpg",
				uid: "cached_uid",
				key: "cached_key",
				file_key: mockFileKey,
				cached_at: Date.now(),
			}

			// 手动添加到缓存
			KnowledgeFileService.fileInfoCache.set(mockFileKey, cachedData)

			const result = await KnowledgeFileService.fetchFileUrl(mockFileKey)

			expect(FileApi.getKnowledgeFileUrl).not.toHaveBeenCalled()
			expect(result).toEqual(cachedData)
		})

		it("should handle API errors gracefully", async () => {
			const mockFileKey = "test_file_key"

			vi.mocked(FileApi.getKnowledgeFileUrl).mockRejectedValue(new Error("API Error"))

			const result = await KnowledgeFileService.fetchFileUrl(mockFileKey)

			expect(result).toBeNull()
		})

		it("should handle invalid API response", async () => {
			const mockFileKey = "test_file_key"

			vi.mocked(FileApi.getKnowledgeFileUrl).mockResolvedValue(null)

			const result = await KnowledgeFileService.fetchFileUrl(mockFileKey)

			expect(result).toBeNull()
		})

		it("should deduplicate concurrent requests for same fileKey", async () => {
			const mockFileKey = "test_file_key"
			const mockResponse = {
				url: "https://example.com/file.jpg",
				expires: Math.floor(Date.now() / 1000) + 3600,
				name: "test.jpg",
				uid: "test_uid",
				key: "test_key",
			}

			// 模拟 API 调用有延迟
			vi.mocked(FileApi.getKnowledgeFileUrl).mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100)),
			)

			// 同时发起多个相同的请求
			const promises = [
				KnowledgeFileService.fetchFileUrl(mockFileKey),
				KnowledgeFileService.fetchFileUrl(mockFileKey),
				KnowledgeFileService.fetchFileUrl(mockFileKey),
			]

			const results = await Promise.all(promises)

			// 验证 API 只被调用了一次
			expect(FileApi.getKnowledgeFileUrl).toHaveBeenCalledTimes(1)
			expect(FileApi.getKnowledgeFileUrl).toHaveBeenCalledWith(mockFileKey)

			// 验证所有请求都返回相同的结果
			results.forEach((result) => {
				expect(result).toEqual({
					...mockResponse,
					file_key: mockFileKey,
					cached_at: expect.any(Number),
				})
			})
		})
	})

	describe("checkFileExpired", () => {
		it("should return true for non-existent file", () => {
			const result = KnowledgeFileService.checkFileExpired("non_existent_key")
			expect(result).toBe(true)
		})

		it("should return false for non-expired file", () => {
			const mockFileKey = "test_file_key"
			const cachedData = {
				url: "https://example.com/file.jpg",
				expires: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
				name: "test.jpg",
				uid: "test_uid",
				key: "test_key",
				file_key: mockFileKey,
				cached_at: Date.now(),
			}

			KnowledgeFileService.fileInfoCache.set(mockFileKey, cachedData)

			const result = KnowledgeFileService.checkFileExpired(mockFileKey)
			expect(result).toBe(false)
		})

		it("should return true for expired file", () => {
			const mockFileKey = "test_file_key"
			const cachedData = {
				url: "https://example.com/file.jpg",
				expires: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
				name: "test.jpg",
				uid: "test_uid",
				key: "test_key",
				file_key: mockFileKey,
				cached_at: Date.now(),
			}

			KnowledgeFileService.fileInfoCache.set(mockFileKey, cachedData)

			const result = KnowledgeFileService.checkFileExpired(mockFileKey)
			expect(result).toBe(true)
		})
	})

	describe("getFileInfoCache", () => {
		it("should return undefined for empty fileKey", () => {
			const result = KnowledgeFileService.getFileInfoCache("")
			expect(result).toBeUndefined()
		})

		it("should return cached data", () => {
			const mockFileKey = "test_file_key"
			const cachedData = {
				url: "https://example.com/file.jpg",
				expires: Math.floor(Date.now() / 1000) + 3600,
				name: "test.jpg",
				uid: "test_uid",
				key: "test_key",
				file_key: mockFileKey,
				cached_at: Date.now(),
			}

			KnowledgeFileService.fileInfoCache.set(mockFileKey, cachedData)

			const result = KnowledgeFileService.getFileInfoCache(mockFileKey)
			expect(result).toEqual(cachedData)
		})
	})

	describe("fetchFileUrls", () => {
		it("should return empty object for empty array", async () => {
			const result = await KnowledgeFileService.fetchFileUrls([])
			expect(result).toEqual({})
		})

		it("should handle batch requests", async () => {
			const mockFileKeys = ["file1", "file2"]
			const mockResponse1 = {
				url: "https://example.com/file1.jpg",
				expires: Math.floor(Date.now() / 1000) + 3600,
				name: "file1.jpg",
				uid: "uid1",
				key: "key1",
			}
			const mockResponse2 = {
				url: "https://example.com/file2.jpg",
				expires: Math.floor(Date.now() / 1000) + 3600,
				name: "file2.jpg",
				uid: "uid2",
				key: "key2",
			}

			vi.mocked(FileApi.getKnowledgeFileUrl)
				.mockResolvedValueOnce(mockResponse1)
				.mockResolvedValueOnce(mockResponse2)

			const result = await KnowledgeFileService.fetchFileUrls(mockFileKeys)

			expect(Object.keys(result)).toHaveLength(2)
			expect(result["file1"]).toEqual({
				...mockResponse1,
				file_key: "file1",
				cached_at: expect.any(Number),
			})
			expect(result["file2"]).toEqual({
				...mockResponse2,
				file_key: "file2",
				cached_at: expect.any(Number),
			})
		})
	})
})
