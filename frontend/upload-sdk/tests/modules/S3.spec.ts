import { describe, it, expect, vi, beforeEach } from "vitest"
import { S3 } from "../../src"
import { PlatformType } from "../../src/types"

// Mock dependencies
vi.mock("../../src/utils/request", () => {
	return {
		request: vi.fn().mockImplementation((options) => {
			if (options.xmlResponse) {
				// Handle XML response for init multipart upload
				if (options.url && options.query && "uploads" in options.query) {
					return Promise.resolve({
						data: {
							Bucket: "test-bucket",
							Key: "test/test.txt",
							UploadId: "test-upload-id",
						},
						headers: {},
					})
				}
				// Complete multipart upload
				return Promise.resolve({
					data: {
						CompleteMultipartUploadResult: {
							Location: "https://s3.example.com/test-bucket/test/test.txt",
							Bucket: "test-bucket",
							Key: "test/test.txt",
							ETag: "etag-final",
						},
					},
					headers: {},
					code: 1000,
					message: "Request successful",
				})
			}
			// Handle regular responses
			if (options.query && "partNumber" in options.query) {
				// Upload part
				return Promise.resolve({
					data: null,
					headers: { etag: `etag-${options.query.partNumber}` },
				})
			}
			// Simple upload
			return Promise.resolve({
				data: null,
				headers: { etag: "simple-upload-etag" },
			})
		}),
	}
})

describe("S3 Upload Module", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Pre-signed URL Upload", () => {
		it("should upload using pre-signed URL", async () => {
			const file = new File(["test content"], "test.txt", { type: "text/plain" })
			const key = "test.txt"
			const params: any = {
				url: "https://s3.example.com/test-bucket/test.txt?signature=xxx",
				method: "PUT",
			}
			const option = {}

			const result = await S3.defaultUpload(file, key, params, option)

			expect(result).toBeDefined()
			expect(result.code).toBe(1000)
			expect(result.data.platform).toBe(PlatformType.S3)
		})

		it("should throw error if URL is missing", async () => {
			const file = new File(["test content"], "test.txt", { type: "text/plain" })
			const key = "test.txt"
			const params: any = {
				method: "PUT",
			}
			const option = {}

			await expect(S3.defaultUpload(file, key, params, option)).rejects.toThrow()
		})
	})

	describe("STS Upload (AccessKey/SecretKey)", () => {
		it("should upload using AccessKey/SecretKey", async () => {
			const file = new File(["test content"], "test.txt", { type: "text/plain" })
			const key = "test.txt"
			const params: any = {
				bucket: "test-bucket",
				region: "us-east-1",
				dir: "uploads/",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
				endpoint: "https://s3.example.com",
			}
			const option = {}

			const result = await S3.signedUpload(file, key, params, option)

			expect(result).toBeDefined()
			expect(result.code).toBe(1000)
			expect(result.data.platform).toBe(PlatformType.S3)
		})

		it("should throw error if required parameters are missing", async () => {
			const file = new File(["test content"], "test.txt", { type: "text/plain" })
			const key = "test.txt"
			const params: any = {
				bucket: "test-bucket",
				// Missing other required parameters
			}
			const option = {}

			await expect(S3.signedUpload(file, key, params, option)).rejects.toThrow()
		})
	})

	describe("Multipart Upload", () => {
		it("should perform multipart upload for large files", async () => {
			// Create a file larger than 5MB (minimum part size)
			const largeContent = new Array(6 * 1024 * 1024).fill("a").join("")
			const file = new File([largeContent], "large-file.txt", { type: "text/plain" })
			const key = "large-file.txt"
			const params: any = {
				bucket: "test-bucket",
				region: "us-east-1",
				dir: "uploads/",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
				endpoint: "https://s3.example.com",
			}
			const option = {
				partSize: 5 * 1024 * 1024, // 5MB
			}

			const result = await S3.MultipartUpload(file, key, params, option)

			expect(result).toBeDefined()
			expect(result.code).toBe(1000)
			expect(result.data.platform).toBe(PlatformType.S3)
		})

		it("should use simple upload for small files", async () => {
			const smallContent = "small content"
			const file = new File([smallContent], "small-file.txt", { type: "text/plain" })
			const key = "small-file.txt"
			const params: any = {
				bucket: "test-bucket",
				region: "us-east-1",
				dir: "uploads/",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
				endpoint: "https://s3.example.com",
			}
			const option = {}

			const result = await S3.MultipartUpload(file, key, params, option)

			expect(result).toBeDefined()
			expect(result.code).toBe(1000)
		})

		it("should throw error for invalid part size", async () => {
			const largeContent = new Array(6 * 1024 * 1024).fill("a").join("")
			const file = new File([largeContent], "large-file.txt", { type: "text/plain" })
			const key = "large-file.txt"
			const params: any = {
				bucket: "test-bucket",
				region: "us-east-1",
				dir: "uploads/",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
				endpoint: "https://s3.example.com",
			}
			const option = {
				partSize: 1024, // Too small (< 5MB)
			}

			await expect(S3.MultipartUpload(file, key, params, option)).rejects.toThrow()
		})
	})

	describe("Upload Entry Point", () => {
		it("should automatically select pre-signed URL upload", async () => {
			const file = new File(["test content"], "test.txt", { type: "text/plain" })
			const key = "test.txt"
			const params: any = {
				url: "https://s3.example.com/test-bucket/test.txt?signature=xxx",
			}
			const option = {}

			const result = await S3.upload(file, key, params, option)

			expect(result).toBeDefined()
			expect(result.code).toBe(1000)
		})

		it("should automatically select STS upload", async () => {
			const file = new File(["test content"], "test.txt", { type: "text/plain" })
			const key = "test.txt"
			const params: any = {
				bucket: "test-bucket",
				region: "us-east-1",
				dir: "uploads/",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
				endpoint: "https://s3.example.com",
			}
			const option = {}

			const result = await S3.upload(file, key, params, option)

			expect(result).toBeDefined()
		})
	})
})

describe("S3 Signature Utils", () => {
	it("should generate correct date formats", async () => {
		const { getAmzDate, getDateStamp } = await import(
			"../../src/modules/S3/utils/signature"
		)

		const date = new Date("2024-01-01T00:00:00.000Z")
		const amzDate = getAmzDate(date)
		const dateStamp = getDateStamp(date)

		expect(amzDate).toBe("20240101T000000Z")
		expect(dateStamp).toBe("20240101")
	})

	it("should build canonical query string", async () => {
		const { buildCanonicalQueryString } = await import(
			"../../src/modules/S3/utils/signature"
		)

		const query = {
			uploads: "",
			partNumber: 1,
			uploadId: "test-id",
		}

		const result = buildCanonicalQueryString(query)

		expect(result).toBe("partNumber=1&uploadId=test-id&uploads=")
	})

	it("should calculate SHA256 hash", async () => {
		const { sha256 } = await import("../../src/modules/S3/utils/signature")

		const hash = sha256("test")

		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
	})
})

describe("S3 Helper Utils", () => {
	it("should build S3 URL in path-style", async () => {
		const { buildS3Url } = await import("../../src/modules/S3/utils/helper")

		const url = buildS3Url("test-bucket", "test/file.txt", "https://s3.example.com", true)

		// S3 paths should preserve slashes, not encode them
		expect(url).toBe("https://s3.example.com/test-bucket/test/file.txt")
	})

	it("should build S3 URL in virtual-hosted-style", async () => {
		const { buildS3Url } = await import("../../src/modules/S3/utils/helper")

		const url = buildS3Url("test-bucket", "test/file.txt", "https://s3.example.com", false)

		// S3 paths should preserve slashes, not encode them
		expect(url).toBe("https://test-bucket.s3.example.com/test/file.txt")
	})

	it("should build complete multipart XML", async () => {
		const { buildCompleteMultipartXml } = await import("../../src/modules/S3/utils/helper")

		const parts = [
			{ number: 1, etag: "etag1" },
			{ number: 2, etag: "etag2" },
		]

		const xml = buildCompleteMultipartXml(parts)

		expect(xml).toContain("<CompleteMultipartUpload>")
		expect(xml).toContain("<PartNumber>1</PartNumber>")
		expect(xml).toContain("<ETag>etag1</ETag>")
		expect(xml).toContain("<PartNumber>2</PartNumber>")
		expect(xml).toContain("<ETag>etag2</ETag>")
	})

	it("should parse S3 URL in path-style", async () => {
		const { parseS3Url } = await import("../../src/modules/S3/utils/helper")

		const result = parseS3Url("https://s3.example.com/test-bucket/test/file.txt")

		expect(result).toEqual({
			bucket: "test-bucket",
			key: "test/file.txt",
			endpoint: "https://s3.example.com",
		})
	})

	it("should parse S3 URL in virtual-hosted-style", async () => {
		const { parseS3Url } = await import("../../src/modules/S3/utils/helper")

		const result = parseS3Url("https://test-bucket.s3.example.com/test/file.txt")

		expect(result).toEqual({
			bucket: "test-bucket",
			key: "test/file.txt",
			endpoint: "https://s3.example.com",
		})
	})
})

