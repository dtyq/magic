import { describe, test, expect } from "vitest"
import {
	isBlob,
	isBuffer,
	isFile,
	isFunction,
	isIP,
	isJson,
	isObject,
} from "../../src/utils/checkDataFormat"

describe("checkDataFormat 工具函数测试", () => {
	describe("isBlob 函数", () => {
		test("应该正确识别 Blob 对象", () => {
			const blob = new Blob(["test"])
			expect(isBlob(blob)).toBe(true)
		})

		test("应该正确拒绝非 Blob 对象", () => {
			const nonBlob = { size: 4, type: "text/plain" }
			expect(isBlob(nonBlob)).toBe(false)
		})
	})

	describe("isBuffer 函数", () => {
		test("应该正确识别 Buffer 对象", () => {
			const buffer = Buffer.from("test")
			expect(isBuffer(buffer)).toBe(true)
		})

		test("应该正确拒绝非 Buffer 对象", () => {
			const nonBuffer = Uint8Array.from([116, 101, 115, 116])
			expect(isBuffer(nonBuffer)).toBe(false)
		})
	})

	describe("isFile 函数", () => {
		test("应该正确识别 File 对象", () => {
			const file = new File(["test"], "test.txt")
			expect(isFile(file)).toBe(true)
		})

		test("应该正确拒绝非 File 对象", () => {
			const nonFile = { name: "test.txt", size: 4 }
			expect(isFile(nonFile)).toBe(false)
		})
	})

	describe("isFunction 函数", () => {
		test("应该正确识别函数", () => {
			const fn = () => {}
			expect(isFunction(fn)).toBe(true)
		})

		test("应该正确拒绝非函数", () => {
			const nonFn = {
				method: () => {},
			}
			expect(isFunction(nonFn)).toBe(false)
		})
	})

	describe("isIP 函数", () => {
		test("应该正确识别 IPv4 地址", () => {
			expect(isIP("192.168.1.1")).toBe(true)
			expect(isIP("255.255.255.255")).toBe(true)
			expect(isIP("0.0.0.0")).toBe(true)
		})

		test("应该正确拒绝无效的 IPv4 地址", () => {
			expect(isIP("256.0.0.1")).toBe(false)
			expect(isIP("192.168.1")).toBe(false)
			expect(isIP("192.168.1.1.1")).toBe(false)
		})

		test("应该正确识别 IPv6 地址", () => {
			expect(isIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true)
			expect(isIP("::1")).toBe(true)
		})
	})

	describe("isJson 函数", () => {
		test("应该正确识别 JSON 字符串", () => {
			expect(isJson('{"name":"test"}')).toBe(true)
			expect(isJson("[]")).toBe(true)
		})

		test("应该正确拒绝非 JSON 字符串", () => {
			expect(isJson("not a json")).toBe(false)
			expect(isJson("{name:test}")).toBe(false)
		})

		test("应该正确拒绝对于非字符串输入", () => {
			expect(isJson(123)).toBe(false)
			expect(isJson(null)).toBe(false)
			expect(isJson(undefined)).toBe(false)
			expect(isJson({ name: "test" })).toBe(false)
		})
	})

	describe("isObject 函数", () => {
		test("应该正确识别 Object 对象", () => {
			expect(isObject({})).toBe(true)
			expect(isObject({ name: "test" })).toBe(true)
		})

		test("应该正确拒绝非 Object 对象", () => {
			expect(isObject([])).toBe(false)
			expect(isObject(null)).toBe(false)
			expect(isObject(undefined)).toBe(false)
			expect(isObject("string")).toBe(false)
			expect(isObject(123)).toBe(false)
		})
	})
})
