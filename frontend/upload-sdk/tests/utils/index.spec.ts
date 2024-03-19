import { describe, test, expect } from "vitest"
import { checkSpecialCharacters, getFileExtension } from "../../src/utils"

describe("utils 工具函数测试", () => {
	describe("checkSpecialCharacters", () => {
		test("当文件名中包含 % 字符时应返回 true", () => {
			expect(checkSpecialCharacters("file%name.txt")).toBe(true)
			expect(checkSpecialCharacters("my%file.jpg")).toBe(true)
			expect(checkSpecialCharacters("document%.pdf")).toBe(true)
			expect(checkSpecialCharacters("%prefix.docx")).toBe(true)
			expect(checkSpecialCharacters("suffix%.xlsx")).toBe(true)
		})

		test("当文件名中不包含 % 字符时应返回 false", () => {
			expect(checkSpecialCharacters("normal.txt")).toBe(false)
			expect(checkSpecialCharacters("file-name.jpg")).toBe(false)
			expect(checkSpecialCharacters("file_name.pdf")).toBe(false)
			expect(checkSpecialCharacters("filename.docx")).toBe(false)
			expect(checkSpecialCharacters("file name with spaces.xlsx")).toBe(false)
			expect(checkSpecialCharacters("file.with.multiple.dots.txt")).toBe(false)
			expect(checkSpecialCharacters("file+name.txt")).toBe(false)
			expect(checkSpecialCharacters("file&name.txt")).toBe(false)
		})

		test("空文件名应返回 false", () => {
			expect(checkSpecialCharacters("")).toBe(false)
		})
	})

	describe("getFileExtension", () => {
		test("应正确提取常见文件类型的后缀名", () => {
			expect(getFileExtension("document.txt")).toBe("txt")
			expect(getFileExtension("image.jpg")).toBe("jpg")
			expect(getFileExtension("presentation.pptx")).toBe("pptx")
			expect(getFileExtension("spreadsheet.xlsx")).toBe("xlsx")
			expect(getFileExtension("archive.zip")).toBe("zip")
			expect(getFileExtension("video.mp4")).toBe("mp4")
			expect(getFileExtension("audio.mp3")).toBe("mp3")
		})

		test("后缀名应该转换为小写", () => {
			expect(getFileExtension("image.JPG")).toBe("jpg")
			expect(getFileExtension("document.TXT")).toBe("txt")
			expect(getFileExtension("archive.ZIP")).toBe("zip")
		})

		test("如果文件名包含多个点，应只提取最后一个点后的内容", () => {
			expect(getFileExtension("file.with.multiple.dots.txt")).toBe("txt")
			expect(getFileExtension("archive.tar.gz")).toBe("gz")
			expect(getFileExtension("version.1.0.3.json")).toBe("json")
		})

		test("如果文件名没有后缀，应返回空字符串", () => {
			expect(getFileExtension("filename")).toBe("")
			expect(getFileExtension("no_extension")).toBe("")
		})

		test("如果文件名以点结尾，应返回空字符串", () => {
			expect(getFileExtension("filename.")).toBe("")
		})

		test("如果输入是空字符串，应返回空字符串", () => {
			expect(getFileExtension("")).toBe("")
		})
	})
})
