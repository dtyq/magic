import { describe, it, expect } from "vitest"
// @ts-ignore
import "../object-polyfills"

describe("Object Polyfills", () => {
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

		it("should work with array objects", () => {
			const arr = [1, 2, 3]
			expect(Object.hasOwn(arr, "0")).toBe(true)
			expect(Object.hasOwn(arr, "length")).toBe(true)
			expect(Object.hasOwn(arr, "push")).toBe(false) // inherited from Array.prototype
		})

		it("should work with function objects", () => {
			function testFn() {}
			testFn.customProp = "test"

			expect(Object.hasOwn(testFn, "customProp")).toBe(true)
			expect(Object.hasOwn(testFn, "name")).toBe(true)
			expect(Object.hasOwn(testFn, "call")).toBe(false) // inherited from Function.prototype
		})
	})
})
