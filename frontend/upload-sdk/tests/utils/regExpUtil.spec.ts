import { describe, test, expect } from "vitest"
import { parseExtname } from "../../src/utils/regExpUtil"

describe("regExpUtil", () => {
	describe("parseExtname", () => {
		test("应该正确提取文件扩展名", () => {
			// 期望返回带点的扩展名
			expect(parseExtname("my/app/123.mp4")).toBe(".mp4")
			expect(parseExtname("documents/report.pdf")).toBe(".pdf")
			expect(parseExtname("images/photo.jpg")).toBe(".jpg")
			expect(parseExtname("archive.tar.gz")).toBe(".gz")
			expect(parseExtname("C:\\Users\\Documents\\file.txt")).toBe(".txt")
			expect(parseExtname("/home/user/data.json")).toBe(".json")
		})

		test("当文件名没有扩展名时，应该返回空字符串", () => {
			expect(parseExtname("file_without_extension")).toBe("")
			expect(parseExtname("my/app/noextension")).toBe("")
			expect(parseExtname("C:\\Program Files\\App")).toBe("")
		})

		test("当路径以斜杠结尾时，应该返回空字符串", () => {
			expect(parseExtname("my/app/")).toBe("")
			expect(parseExtname("C:\\Users\\")).toBe("")
			expect(parseExtname("/home/user/")).toBe("")
		})

		test("处理特殊情况", () => {
			expect(parseExtname("")).toBe("")
			expect(parseExtname(".hidden")).toBe(".hidden")
			expect(parseExtname(".config.json")).toBe(".json")
			expect(parseExtname("../.file")).toBe(".file")
		})

		test("处理带有点的文件名", () => {
			expect(parseExtname("my.folder/file.txt")).toBe(".txt")
			expect(parseExtname("project.v1/config.json")).toBe(".json")
			expect(parseExtname("app.beta/assets/image.png")).toBe(".png")
		})

		test("应该把parseExtname函数作为一个获取文件扩展名的工具函数", () => {
			expect(typeof parseExtname).toBe("function")
		})
	})
})
