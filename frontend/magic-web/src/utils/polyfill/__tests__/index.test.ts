import { describe, it, expect, vi } from "vitest"
// @ts-ignore
import "../index"

describe("Polyfill Functions", () => {
	describe("Array.prototype.at", () => {
		const testArray = [1, 2, 3, 4, 5]

		it("should return element at positive index", () => {
			expect(testArray.at(0)).toBe(1)
			expect(testArray.at(2)).toBe(3)
			expect(testArray.at(4)).toBe(5)
		})

		it("should return element at negative index", () => {
			expect(testArray.at(-1)).toBe(5)
			expect(testArray.at(-2)).toBe(4)
			expect(testArray.at(-5)).toBe(1)
		})

		it("should return undefined for out of bounds index", () => {
			expect(testArray.at(10)).toBeUndefined()
			expect(testArray.at(-10)).toBeUndefined()
		})
	})

	describe("String.prototype.at", () => {
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
	})

	describe("Array.prototype.findLast", () => {
		const testArray = [1, 2, 3, 4, 5, 4, 3, 2, 1]

		it("should find the last element matching predicate", () => {
			const result = testArray.findLast((x) => x === 4)
			expect(result).toBe(4)
		})

		it("should find the last even number", () => {
			const result = testArray.findLast((x) => x % 2 === 0)
			expect(result).toBe(2)
		})

		it("should return undefined when no element matches", () => {
			const result = testArray.findLast((x) => x === 10)
			expect(result).toBeUndefined()
		})

		it("should return undefined for empty array", () => {
			const result = [].findLast((x) => x === 1)
			expect(result).toBeUndefined()
		})

		it("should work with thisArg", () => {
			const context = { threshold: 3 }
			const result = testArray.findLast(function (this: { threshold: number }, x) {
				return x > this.threshold
			}, context)
			expect(result).toBe(4)
		})

		it("should provide correct arguments to predicate", () => {
			const mockPredicate = vi.fn(() => true)
			testArray.findLast(mockPredicate)

			// Should be called with (value, index, array)
			expect(mockPredicate).toHaveBeenCalledWith(1, 8, testArray)
		})
	})

	describe("Array.prototype.findLastIndex", () => {
		const testArray = [1, 2, 3, 4, 5, 4, 3, 2, 1]

		it("should find the last index of element matching predicate", () => {
			const result = testArray.findLastIndex((x) => x === 4)
			expect(result).toBe(5)
		})

		it("should find the last index of even number", () => {
			const result = testArray.findLastIndex((x) => x % 2 === 0)
			expect(result).toBe(7)
		})

		it("should return -1 when no element matches", () => {
			const result = testArray.findLastIndex((x) => x === 10)
			expect(result).toBe(-1)
		})

		it("should return -1 for empty array", () => {
			const result = [].findLastIndex((x) => x === 1)
			expect(result).toBe(-1)
		})

		it("should work with thisArg", () => {
			const context = { threshold: 3 }
			const result = testArray.findLastIndex(function (this: { threshold: number }, x) {
				return x > this.threshold
			}, context)
			expect(result).toBe(5)
		})

		it("should provide correct arguments to predicate", () => {
			const mockPredicate = vi.fn(() => true)
			testArray.findLastIndex(mockPredicate)

			// Should be called with (value, index, array)
			expect(mockPredicate).toHaveBeenCalledWith(1, 8, testArray)
		})
	})

	describe("Object.hasOwn", () => {
		it("should return true for own properties", () => {
			const obj = { a: 1, b: 2 }
			expect(Object.hasOwn(obj, "a")).toBe(true)
			expect(Object.hasOwn(obj, "b")).toBe(true)
		})

		it("should return false for inherited properties", () => {
			const obj = Object.create({ inherited: true })
			obj.own = true

			expect(Object.hasOwn(obj, "own")).toBe(true)
			expect(Object.hasOwn(obj, "inherited")).toBe(false)
		})

		it("should return false for non-existent properties", () => {
			const obj = { a: 1 }
			expect(Object.hasOwn(obj, "nonExistent")).toBe(false)
		})

		it("should throw TypeError for null object", () => {
			expect(() => Object.hasOwn(null as any, "prop")).toThrow(TypeError)
		})
	})
})
