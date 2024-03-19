import { describe, expect, it } from "vitest"
import {
	TEMP_PATH_PREFIX,
	isTempPath,
	generateTempSrc,
	extractFileNameFromTempPath,
} from "../temp-path-utils"

describe("temp-path-utils", () => {
	describe("TEMP_PATH_PREFIX", () => {
		it("should have correct prefix value", () => {
			expect(TEMP_PATH_PREFIX).toBe("temp_")
		})
	})

	describe("isTempPath", () => {
		it("should return true for temporary paths", () => {
			expect(isTempPath("temp_12345_abc/test.jpg")).toBe(true)
			expect(isTempPath("temp_67890_xyz/image.png")).toBe(true)
			expect(isTempPath("temp_")).toBe(true)
		})

		it("should return false for non-temporary paths", () => {
			expect(isTempPath("./images/photo.jpg")).toBe(false)
			expect(isTempPath("images/photo.jpg")).toBe(false)
			expect(isTempPath("/absolute/path/image.png")).toBe(false)
			expect(isTempPath("temporary_file.jpg")).toBe(false)
		})

		it("should return false for null or undefined", () => {
			expect(isTempPath(null)).toBe(false)
			expect(isTempPath(undefined)).toBe(false)
		})

		it("should return false for empty string", () => {
			expect(isTempPath("")).toBe(false)
		})
	})

	describe("generateTempSrc", () => {
		it("should generate path with correct prefix", () => {
			const result = generateTempSrc("test.jpg")
			expect(result).toMatch(/^temp_\d+_[a-z0-9]+\/test\.jpg$/)
		})

		it("should generate unique paths", () => {
			const path1 = generateTempSrc("test.jpg")
			const path2 = generateTempSrc("test.jpg")
			expect(path1).not.toBe(path2)
		})

		it("should preserve file name", () => {
			const fileName = "my-image.png"
			const result = generateTempSrc(fileName)
			expect(result.endsWith(fileName)).toBe(true)
		})

		it("should handle files with special characters", () => {
			const fileName = "图片 测试.jpg"
			const result = generateTempSrc(fileName)
			expect(result.endsWith(fileName)).toBe(true)
			expect(isTempPath(result)).toBe(true)
		})
	})

	describe("extractFileNameFromTempPath", () => {
		it("should extract file name from temporary path", () => {
			const tempPath = "temp_12345_abc/test.jpg"
			expect(extractFileNameFromTempPath(tempPath)).toBe("test.jpg")
		})

		it("should handle complex file names", () => {
			const tempPath = "temp_67890_xyz/my-image-v2.final.png"
			expect(extractFileNameFromTempPath(tempPath)).toBe("my-image-v2.final.png")
		})

		it("should return null for non-temporary paths", () => {
			expect(extractFileNameFromTempPath("./images/photo.jpg")).toBe(null)
			expect(extractFileNameFromTempPath("regular/path/file.jpg")).toBe(null)
		})

		it("should handle paths with multiple slashes", () => {
			const tempPath = "temp_12345_abc/folder/subfolder/test.jpg"
			expect(extractFileNameFromTempPath(tempPath)).toBe("test.jpg")
		})

		it("should return null for invalid temp paths", () => {
			expect(extractFileNameFromTempPath("temp_12345_abc/")).toBe(null)
			expect(extractFileNameFromTempPath("temp_")).toBe(null)
		})
	})

	describe("Integration tests", () => {
		it("should work together - generate and verify", () => {
			const fileName = "test-image.jpg"
			const tempPath = generateTempSrc(fileName)

			expect(isTempPath(tempPath)).toBe(true)
			expect(extractFileNameFromTempPath(tempPath)).toBe(fileName)
		})

		it("should handle multiple generations and verifications", () => {
			const files = ["image1.jpg", "image2.png", "document.pdf"]

			files.forEach((fileName) => {
				const tempPath = generateTempSrc(fileName)
				expect(isTempPath(tempPath)).toBe(true)
				expect(extractFileNameFromTempPath(tempPath)).toBe(fileName)
			})
		})
	})
})
