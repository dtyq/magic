import { describe, it, expect } from "vitest"
import { normalizeImageName, isValidImageId } from "../utils"

describe("normalizeImageName", () => {
	it("should remove English parentheses", () => {
		expect(normalizeImageName("image (1).png")).toBe("image1.png")
		expect(normalizeImageName("photo (copy).jpg")).toBe("photocopy.jpg")
	})

	it("should remove Chinese parentheses", () => {
		expect(normalizeImageName("图片（副本）.jpg")).toBe("图片副本.jpg")
		expect(normalizeImageName("照片（1）.png")).toBe("照片1.png")
	})

	it("should remove spaces", () => {
		expect(normalizeImageName("my photo.png")).toBe("myphoto.png")
		expect(normalizeImageName("image file name.jpg")).toBe("imagefilename.jpg")
	})

	it("should remove mixed spaces and parentheses", () => {
		expect(normalizeImageName("my photo (copy).png")).toBe("myphotocopy.png")
		expect(normalizeImageName("文件 名称（副本）.jpg")).toBe("文件名称副本.jpg")
	})

	it("should remove leading dots", () => {
		expect(normalizeImageName("...image.png")).toBe("image.png")
		expect(normalizeImageName(".hidden.jpg")).toBe("hidden.jpg")
	})

	it("should replace multiple dots with single dot", () => {
		expect(normalizeImageName("image..png")).toBe("image.png")
		expect(normalizeImageName("photo...jpg")).toBe("photo.jpg")
	})

	it("should handle file names without extension", () => {
		expect(normalizeImageName("image (1)")).toBe("image1")
		expect(normalizeImageName("no extension")).toBe("noextension")
	})

	it("should handle already normalized names", () => {
		expect(normalizeImageName("normalimage.png")).toBe("normalimage.png")
		expect(normalizeImageName("simple.jpg")).toBe("simple.jpg")
	})

	it("should handle complex cases", () => {
		expect(normalizeImageName("  my  image  (copy) .png")).toBe("myimagecopy.png")
		expect(normalizeImageName("测试 图片（副本 1）.jpg")).toBe("测试图片副本1.jpg")
	})

	it("should preserve file extension", () => {
		expect(normalizeImageName("image (1).png")).toBe("image1.png")
		expect(normalizeImageName("photo.jpeg")).toBe("photo.jpeg")
		expect(normalizeImageName("file.webp")).toBe("file.webp")
	})
})

describe("isValidImageId", () => {
	it("should return true for valid image IDs", () => {
		expect(isValidImageId("abc123")).toBe(true)
		expect(isValidImageId("image-id-123")).toBe(true)
		expect(isValidImageId("x")).toBe(true)
	})

	it("should return false for empty strings", () => {
		expect(isValidImageId("")).toBe(false)
	})

	it("should return false for non-string values", () => {
		expect(isValidImageId(null as any)).toBe(false)
		expect(isValidImageId(undefined as any)).toBe(false)
		expect(isValidImageId(123 as any)).toBe(false)
	})
})
