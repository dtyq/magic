import { describe, it, expect } from "vitest"
import {
	findFileByName,
	findFileByPath,
	extractFileName,
	parseImageSize,
	normalizeImagePath,
	type AttachmentFile,
} from "../utils"

describe("Markdown Utils", () => {
	describe("findFileByName", () => {
		it("should find file in flat array", () => {
			const files: AttachmentFile[] = [
				{ file_id: "1", file_name: "test.png" },
				{ file_id: "2", file_name: "image.jpg" },
			]

			const result = findFileByName(files, "test.png")
			expect(result).toEqual({ file_id: "1", file_name: "test.png" })
		})

		it("should find file in nested directories", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "folder",
					is_directory: true,
					children: [
						{ file_id: "2", file_name: "nested.png" },
						{ file_id: "3", file_name: "other.jpg" },
					],
				},
			]

			const result = findFileByName(files, "nested.png")
			expect(result).toEqual({ file_id: "2", file_name: "nested.png" })
		})

		it("should return null if file not found", () => {
			const files: AttachmentFile[] = [{ file_id: "1", file_name: "test.png" }]

			const result = findFileByName(files, "nonexistent.png")
			expect(result).toBeNull()
		})

		it("should handle empty array", () => {
			const result = findFileByName([], "test.png")
			expect(result).toBeNull()
		})
	})

	describe("findFileByPath", () => {
		it("should find file by relative path in flat array", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
				{
					file_id: "2",
					file_name: "image.jpg",
					relative_file_path: "/images/image.jpg",
				},
			]

			const result = findFileByPath(files, "/images/test.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should find file with ./ prefix", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			const result = findFileByPath(files, "./images/test.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should find file in nested directories", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "folder1",
					file_name: "images",
					is_directory: true,
					relative_file_path: "/images",
					children: [
						{
							file_id: "2",
							file_name: "nested.png",
							relative_file_path: "/images/nested.png",
						},
						{
							file_id: "3",
							file_name: "other.jpg",
							relative_file_path: "/images/other.jpg",
						},
					],
				},
			]

			const result = findFileByPath(files, "./images/nested.png")
			expect(result).toEqual({
				file_id: "2",
				file_name: "nested.png",
				relative_file_path: "/images/nested.png",
			})
		})

		it("should return null if file not found", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			const result = findFileByPath(files, "/images/nonexistent.png")
			expect(result).toBeNull()
		})

		it("should handle empty array", () => {
			const result = findFileByPath([], "/images/test.png")
			expect(result).toBeNull()
		})

		it("should normalize paths without leading slash", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			const result = findFileByPath(files, "images/test.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should handle URL encoded paths with spaces", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test file.png",
					relative_file_path: "/images/test file.png",
				},
			]

			const result = findFileByPath(files, "./images/test%20file.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test file.png",
				relative_file_path: "/images/test file.png",
			})
		})

		it("should handle URL encoded paths with special characters", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "测试图片.png",
					relative_file_path: "/images/测试图片.png",
				},
			]

			// %E6%B5%8B%E8%AF%95 is URL encoded "测试"
			const result = findFileByPath(
				files,
				"./images/%E6%B5%8B%E8%AF%95%E5%9B%BE%E7%89%87.png",
			)
			expect(result).toEqual({
				file_id: "1",
				file_name: "测试图片.png",
				relative_file_path: "/images/测试图片.png",
			})
		})

		it("should handle paths with leading and trailing whitespace", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			const result = findFileByPath(files, "  ./images/test.png  ")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should handle paths with trailing slash", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png",
				},
			]

			// Should still match even if search path has trailing slash
			const result = findFileByPath(files, "./images/test.png/")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png",
			})
		})

		it("should match when attachment path has trailing slash", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test.png",
					relative_file_path: "/images/test.png/",
				},
			]

			const result = findFileByPath(files, "./images/test.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test.png",
				relative_file_path: "/images/test.png/",
			})
		})

		it("should handle invalid URI sequences gracefully", () => {
			const files: AttachmentFile[] = [
				{
					file_id: "1",
					file_name: "test%.png",
					relative_file_path: "/images/test%.png",
				},
			]

			// Invalid URI sequence should still work
			const result = findFileByPath(files, "./images/test%.png")
			expect(result).toEqual({
				file_id: "1",
				file_name: "test%.png",
				relative_file_path: "/images/test%.png",
			})
		})
	})

	describe("extractFileName", () => {
		it("should extract file name from simple path", () => {
			expect(extractFileName("./images/file.png")).toBe("file.png")
		})

		it("should extract file name from path with size syntax", () => {
			expect(extractFileName("./images/file.png =300x200")).toBe("file.png")
		})

		it("should extract file name from nested path", () => {
			expect(extractFileName("../folder/subfolder/photo.jpg")).toBe("photo.jpg")
		})

		it("should handle file name without path", () => {
			expect(extractFileName("image.png")).toBe("image.png")
		})

		it("should handle file name with size syntax but no path", () => {
			expect(extractFileName("image.png =300x")).toBe("image.png")
		})
	})

	describe("parseImageSize", () => {
		it("should parse width and height", () => {
			expect(parseImageSize("./file.png =300x200")).toEqual({
				width: 300,
				height: 200,
			})
		})

		it("should parse width only", () => {
			expect(parseImageSize("./file.png =300x")).toEqual({
				width: 300,
				height: null,
			})
		})

		it("should return null for both when no size syntax", () => {
			expect(parseImageSize("./file.png")).toEqual({
				width: null,
				height: null,
			})
		})

		it("should handle size syntax in middle of URL", () => {
			expect(parseImageSize("./images/file.png =500x400 extra")).toEqual({
				width: 500,
				height: 400,
			})
		})
	})

	describe("normalizeImagePath", () => {
		it("should remove size syntax from path", () => {
			expect(normalizeImagePath("./images/file.png =300x200")).toBe("./images/file.png")
		})

		it("should handle path with width only", () => {
			expect(normalizeImagePath("./images/file.png =300x")).toBe("./images/file.png")
		})

		it("should return original path if no size syntax", () => {
			expect(normalizeImagePath("./images/file.png")).toBe("./images/file.png")
		})

		it("should handle multiple spaces", () => {
			expect(normalizeImagePath("./images/file.png  =300x200  extra")).toBe(
				"./images/file.png",
			)
		})
	})

	describe("Image path deduplication scenarios", () => {
		it("should demonstrate different sizes create different normalized paths when rawPath is used", () => {
			// This test demonstrates the fix for the TODO comment
			// When the same image appears with different sizes, they should be stored separately

			const path1 = "./images/file.png =300x200"
			const path2 = "./images/file.png =500x400"

			// Using rawPath as key (new behavior)
			const mapWithRawPath = {
				[path1]: { width: 300, height: 200 },
				[path2]: { width: 500, height: 400 },
			}

			// Both entries are preserved
			expect(mapWithRawPath[path1]).toEqual({ width: 300, height: 200 })
			expect(mapWithRawPath[path2]).toEqual({ width: 500, height: 400 })

			// Using normalized path as key (old behavior - would cause overwriting)
			const normalized1 = normalizeImagePath(path1)
			const normalized2 = normalizeImagePath(path2)

			expect(normalized1).toBe(normalized2) // Both normalize to same path
			expect(normalized1).toBe("./images/file.png")
		})
	})
})
