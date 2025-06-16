import { describe, it, expect } from "vitest"
import {
	safeBtoa,
	safeAtob,
	safeJsonToBtoa,
	safeBtoaToJson,
	safeBinaryToBtoa,
	isValidBase64,
} from "../encoding"

describe("encoding utilities", () => {
	describe("safeBtoa", () => {
		it("should encode ASCII string correctly", () => {
			const input = "Hello World"
			const result = safeBtoa(input)
			expect(result).toBe(btoa(encodeURIComponent(input)))
		})

		it("should handle Unicode characters", () => {
			const input = "你好世界"
			const result = safeBtoa(input)
			expect(result).toBeTruthy()
			expect(result).not.toBe("")
		})

		it("should handle emoji", () => {
			const input = "🚀 Hello 世界"
			const result = safeBtoa(input)
			expect(result).toBeTruthy()
			expect(result).not.toBe("")
		})

		it("should return empty string on error", () => {
			// Mock btoa to throw error
			const originalBtoa = global.btoa
			global.btoa = () => {
				throw new Error("Mock error")
			}

			const result = safeBtoa("test")
			expect(result).toBe("")

			// Restore original btoa
			global.btoa = originalBtoa
		})
	})

	describe("safeAtob", () => {
		it("should decode correctly encoded string", () => {
			const input = "Hello World"
			const encoded = safeBtoa(input)
			const decoded = safeAtob(encoded)
			expect(decoded).toBe(input)
		})

		it("should handle Unicode characters", () => {
			const input = "你好世界"
			const encoded = safeBtoa(input)
			const decoded = safeAtob(encoded)
			expect(decoded).toBe(input)
		})

		it("should return empty string on invalid base64", () => {
			const result = safeAtob("invalid-base64!")
			expect(result).toBe("")
		})
	})

	describe("safeJsonToBtoa", () => {
		it("should encode simple object", () => {
			const obj = { name: "test", value: 123 }
			const result = safeJsonToBtoa(obj)
			expect(result).toBeTruthy()
			expect(result).not.toBe("")
		})

		it("should handle object with Unicode properties", () => {
			const obj = {
				name: "测试文件.jpg",
				description: "这是一个测试文件 🚀",
				emoji: "😀",
			}
			const result = safeJsonToBtoa(obj)
			expect(result).toBeTruthy()
			expect(result).not.toBe("")
		})

		it("should handle null and undefined", () => {
			expect(safeJsonToBtoa(null)).toBeTruthy()
			expect(safeJsonToBtoa(undefined)).toBeTruthy()
		})

		it("should handle circular references gracefully", () => {
			const obj: any = { name: "test" }
			obj.self = obj // Create circular reference

			const result = safeJsonToBtoa(obj)
			expect(result).toBe("") // Should return empty string due to JSON.stringify error
		})
	})

	describe("safeBtoaToJson", () => {
		it("should decode JSON object correctly", () => {
			const obj = { name: "test", value: 123 }
			const encoded = safeJsonToBtoa(obj)
			const decoded = safeBtoaToJson(encoded)
			expect(decoded).toEqual(obj)
		})

		it("should handle Unicode in JSON", () => {
			const obj = {
				fileName: "测试文件.jpg",
				description: "这是一个测试 🚀",
			}
			const encoded = safeJsonToBtoa(obj)
			const decoded = safeBtoaToJson(encoded)
			expect(decoded).toEqual(obj)
		})

		it("should return null on invalid input", () => {
			const result = safeBtoaToJson("invalid-base64!")
			expect(result).toBeNull()
		})
	})

	describe("safeBinaryToBtoa", () => {
		it("should encode Uint8Array correctly", () => {
			const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
			const result = safeBinaryToBtoa(data)
			expect(result).toBe(btoa("Hello"))
		})

		it("should encode ArrayBuffer correctly", () => {
			const buffer = new ArrayBuffer(5)
			const view = new Uint8Array(buffer)
			view.set([72, 101, 108, 108, 111]) // "Hello"

			const result = safeBinaryToBtoa(buffer)
			expect(result).toBe(btoa("Hello"))
		})

		it("should handle large binary data", () => {
			// Create a large buffer (larger than chunk size)
			const size = 100000 // 100KB
			const data = new Uint8Array(size)
			for (let i = 0; i < size; i++) {
				data[i] = i % 256
			}

			const result = safeBinaryToBtoa(data)
			expect(result).toBeTruthy()
			expect(result).not.toBe("")
		})

		it("should handle binary data with high byte values", () => {
			const data = new Uint8Array([255, 254, 253, 252, 251])
			const result = safeBinaryToBtoa(data)
			expect(result).toBeTruthy()
			expect(result).not.toBe("")
		})
	})

	describe("isValidBase64", () => {
		it("should return true for valid base64", () => {
			const validBase64 = btoa("Hello World")
			expect(isValidBase64(validBase64)).toBe(true)
		})

		it("should return false for invalid base64", () => {
			expect(isValidBase64("invalid-base64!")).toBe(false)
			expect(isValidBase64("Hello World")).toBe(false)
			expect(isValidBase64("")).toBe(false)
		})

		it("should handle edge cases", () => {
			expect(isValidBase64("=")).toBe(false)
			expect(isValidBase64("==")).toBe(false)
			expect(isValidBase64("A")).toBe(false) // Invalid padding
			expect(isValidBase64("QQ==")).toBe(true) // Valid base64 for 'A'
		})
	})

	describe("integration tests", () => {
		it("should handle complete encoding/decoding cycle with Unicode", () => {
			const originalData = {
				fileName: "测试文件名.jpg",
				description: "This is a test file with emoji 🚀 and Chinese 中文",
				metadata: {
					size: 1024,
					type: "image/jpeg",
					tags: ["测试", "test", "🏷️"],
				},
			}

			// Encode to base64
			const encoded = safeJsonToBtoa(originalData)
			expect(encoded).toBeTruthy()
			expect(encoded).not.toBe("")

			// Decode back to object
			const decoded = safeBtoaToJson(encoded)
			expect(decoded).toEqual(originalData)
		})

		it("should be compatible with existing btoa usage patterns", () => {
			const testCases = [
				"simple string",
				"string with spaces",
				"",
				"123456789",
				"special!@#$%^&*()chars",
			]

			testCases.forEach((testCase) => {
				const safeResult = safeBtoa(testCase)
				const originalResult = btoa(encodeURIComponent(testCase))
				expect(safeResult).toBe(originalResult)
			})
		})
	})
})
