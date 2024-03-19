import { describe, it, expect, beforeEach } from "vitest"
// @ts-ignore
import "../string-polyfills"

describe("String Polyfills", () => {
	describe("String.prototype.at", () => {
		beforeEach(() => {
			// Ensure the polyfill is applied
			if (!String.prototype.at) {
				throw new Error("at polyfill not loaded")
			}
		})

		const testString = "hello"

		it("should return character at positive index", () => {
			expect(testString.at(0)).toBe("h")
			expect(testString.at(2)).toBe("l")
			expect(testString.at(4)).toBe("o")
		})

		it("should return character at negative index", () => {
			expect(testString.at(-1)).toBe("o")
			expect(testString.at(-2)).toBe("l")
			expect(testString.at(-5)).toBe("h")
		})

		it("should return undefined for out of bounds index", () => {
			expect(testString.at(10)).toBeUndefined()
			expect(testString.at(-10)).toBeUndefined()
		})

		it("should work with empty string", () => {
			const emptyString = ""
			expect(emptyString.at(0)).toBeUndefined()
			expect(emptyString.at(-1)).toBeUndefined()
		})

		it("should work with single character string", () => {
			const singleChar = "a"
			expect(singleChar.at(0)).toBe("a")
			expect(singleChar.at(-1)).toBe("a")
			expect(singleChar.at(1)).toBeUndefined()
		})
	})

	describe("String.prototype.replaceAll", () => {
		beforeEach(() => {
			// Ensure the polyfill is applied
			if (!String.prototype.replaceAll) {
				throw new Error("replaceAll polyfill not loaded")
			}
		})

		describe("basic string replacement", () => {
			it("should replace all occurrences of a string", () => {
				const result = "hello world hello".replaceAll("hello", "hi")
				expect(result).toBe("hi world hi")
			})

			it("should return the same string if no matches found", () => {
				const result = "hello world".replaceAll("foo", "bar")
				expect(result).toBe("hello world")
			})

			it("should handle empty search string", () => {
				const result = "abc".replaceAll("", "x")
				expect(result).toBe("xaxbxcx")
			})

			it("should handle empty replacement string", () => {
				const result = "hello world hello".replaceAll("hello", "")
				expect(result).toBe(" world ")
			})

			it("should handle empty source string", () => {
				const result = "".replaceAll("hello", "hi")
				expect(result).toBe("")
			})
		})

		describe("function replacement", () => {
			it("should call replacement function for each match", () => {
				const calls: Array<{ match: string; offset: number; string: string }> = []
				const result = "hello world hello".replaceAll("hello", (match, offset, string) => {
					calls.push({ match, offset, string })
					return "hi"
				})

				expect(result).toBe("hi world hi")
				expect(calls).toHaveLength(2)
				expect(calls[0]).toEqual({ match: "hello", offset: 0, string: "hello world hello" })
				expect(calls[1]).toEqual({
					match: "hello",
					offset: 12,
					string: "hello world hello",
				})
			})

			it("should handle function replacement with empty search string", () => {
				const calls: Array<{ match: string; offset: number; string: string }> = []
				const result = "ab".replaceAll("", (match, offset, string) => {
					calls.push({ match, offset, string })
					return "x"
				})

				expect(result).toBe("xaxbx")
				expect(calls).toHaveLength(3)
			})
		})

		describe("RegExp replacement", () => {
			it("should work with global RegExp", () => {
				const result = "hello world hello".replaceAll(/hello/g, "hi")
				expect(result).toBe("hi world hi")
			})

			it("should work with global RegExp and function replacement", () => {
				const result = "hello world hello".replaceAll(/hello/g, () => "hi")
				expect(result).toBe("hi world hi")
			})

			it("should throw TypeError for non-global RegExp", () => {
				expect(() => {
					"hello world hello".replaceAll(/hello/, "hi")
				}).toThrow(TypeError)
				expect(() => {
					"hello world hello".replaceAll(/hello/, "hi")
				}).toThrow("String.prototype.replaceAll called with a non-global RegExp argument")
			})
		})

		describe("edge cases", () => {
			it("should handle overlapping patterns correctly", () => {
				const result = "aaa".replaceAll("aa", "b")
				expect(result).toBe("ba")
			})

			it("should handle replacement that creates new matches", () => {
				const result = "abc".replaceAll("b", "bb")
				expect(result).toBe("abbc")
			})

			it("should handle special characters in search string", () => {
				const result = "a.b*c+d".replaceAll(".", "x")
				expect(result).toBe("axb*c+d")
			})

			it("should convert non-string arguments to strings", () => {
				const result = "123 456 123".replaceAll(123 as any, "xxx")
				expect(result).toBe("xxx 456 xxx")
			})
		})
	})
})
