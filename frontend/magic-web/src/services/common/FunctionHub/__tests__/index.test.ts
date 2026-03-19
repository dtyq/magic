import { describe, it, expect, beforeEach } from "vitest"
import {
	FunctionHub,
	ScopedFunctionHub,
	functionHub,
	FunctionNotFoundError,
	FunctionAlreadyExistsError,
	FunctionExecutionError,
} from "../index"

describe("FunctionHub Module Exports", () => {
	describe("Class exports", () => {
		it("should export FunctionHub class", () => {
			// Act & Assert
			expect(FunctionHub).toBeDefined()
			expect(typeof FunctionHub).toBe("function")
			expect(new FunctionHub()).toBeInstanceOf(FunctionHub)
		})

		it("should export ScopedFunctionHub class", () => {
			// Act & Assert
			expect(ScopedFunctionHub).toBeDefined()
			expect(typeof ScopedFunctionHub).toBe("function")
		})
	})

	describe("Error exports", () => {
		it("should export FunctionNotFoundError", () => {
			// Act & Assert
			expect(FunctionNotFoundError).toBeDefined()
			expect(typeof FunctionNotFoundError).toBe("function")
			expect(new FunctionNotFoundError("test")).toBeInstanceOf(Error)
			expect(new FunctionNotFoundError("test")).toBeInstanceOf(FunctionNotFoundError)
		})

		it("should export FunctionAlreadyExistsError", () => {
			// Act & Assert
			expect(FunctionAlreadyExistsError).toBeDefined()
			expect(typeof FunctionAlreadyExistsError).toBe("function")
			expect(new FunctionAlreadyExistsError("test")).toBeInstanceOf(Error)
			expect(new FunctionAlreadyExistsError("test")).toBeInstanceOf(
				FunctionAlreadyExistsError,
			)
		})

		it("should export FunctionExecutionError", () => {
			// Act & Assert
			expect(FunctionExecutionError).toBeDefined()
			expect(typeof FunctionExecutionError).toBe("function")

			const originalError = new Error("Original")
			const executionError = new FunctionExecutionError("test", originalError)

			expect(executionError).toBeInstanceOf(Error)
			expect(executionError).toBeInstanceOf(FunctionExecutionError)
			expect(executionError.cause).toBe(originalError)
		})
	})

	describe("Default instance export", () => {
		beforeEach(() => {
			// Clean up the default instance before each test
			functionHub.clear()
		})

		it("should export functionHub default instance", () => {
			// Act & Assert
			expect(functionHub).toBeDefined()
			expect(functionHub).toBeInstanceOf(FunctionHub)
		})

		it("should allow using default instance immediately", () => {
			// Arrange
			const testFn = (name: string) => `Hello, ${name}!`

			// Act
			functionHub.register({
				name: "greet",
				fn: testFn,
				description: "Greets a person",
			})

			const result = functionHub.execute("greet", "World")

			// Assert
			expect(result).toBe("Hello, World!")
			expect(functionHub.has("greet")).toBe(true)
			expect(functionHub.size()).toBe(1)
		})

		it("should support scoped operations on default instance", () => {
			// Act
			const mathScope = functionHub.scope("math")
			mathScope.register({
				name: "add",
				fn: (a: number, b: number) => a + b,
			})

			// Assert
			expect(mathScope).toBeInstanceOf(ScopedFunctionHub)
			expect(functionHub.has("math.add")).toBe(true)
			expect(mathScope.has("add")).toBe(true)
		})

		it("should persist state across operations on default instance", () => {
			// Arrange
			functionHub.register({ name: "func1", fn: () => 1 })
			functionHub.register({ name: "func2", fn: () => 2 })

			// Act
			const initialSize = functionHub.size()
			const meta1 = functionHub.getMeta("func1")

			functionHub.remove("func1")
			const afterRemoveSize = functionHub.size()

			// Assert
			expect(initialSize).toBe(2)
			expect(afterRemoveSize).toBe(1)
			expect(meta1).toBeDefined()
			expect(meta1?.name).toBe("func1")
			expect(functionHub.has("func1")).toBe(false)
			expect(functionHub.has("func2")).toBe(true)
		})

		it("should allow batch operations on default instance", () => {
			// Arrange
			const functions = [
				{ name: "add", fn: (a: number, b: number) => a + b },
				{ name: "subtract", fn: (a: number, b: number) => a - b },
				{ name: "multiply", fn: (a: number, b: number) => a * b },
			]

			// Act
			functionHub.batch(functions)

			// Assert
			expect(functionHub.size()).toBe(3)
			expect(functionHub.has("add")).toBe(true)
			expect(functionHub.has("subtract")).toBe(true)
			expect(functionHub.has("multiply")).toBe(true)
		})
	})

	describe("Module integration", () => {
		it("should allow creating multiple independent instances", () => {
			// Arrange
			const hub1 = new FunctionHub()
			const hub2 = new FunctionHub()

			// Act
			hub1.register({ name: "test", fn: () => "hub1" })
			hub2.register({ name: "test", fn: () => "hub2" })

			// Assert
			expect(hub1.has("test")).toBe(true)
			expect(hub2.has("test")).toBe(true)
			expect(hub1.size()).toBe(1)
			expect(hub2.size()).toBe(1)
			// Each instance should be independent
			expect(hub1.has("test")).toBe(true)
			expect(hub2.has("test")).toBe(true)
		})

		it("should handle errors consistently across all components", () => {
			// Arrange
			const customHub = new FunctionHub()

			// Test function registration error
			customHub.register({ name: "test", fn: () => "test" })

			expect(() => {
				customHub.register({ name: "test", fn: () => "duplicate" })
			}).toThrow(FunctionAlreadyExistsError)

			// Test function execution error
			customHub.register({
				name: "failing",
				fn: () => {
					throw new Error("Function failed")
				},
			})

			expect(() => customHub.execute("failing")).toThrow(FunctionExecutionError)

			// Test non-existent function error
			expect(() => customHub.execute("nonExistent")).toThrow(FunctionNotFoundError)
		})

		it("should handle different function types correctly", () => {
			// Arrange
			const customHub = new FunctionHub()

			// Act
			customHub.register({
				name: "stringFunction",
				fn: (input: string) => input.toUpperCase(),
			})

			customHub.register({
				name: "numberFunction",
				fn: (a: number, b: number) => a + b,
			})

			customHub.register({
				name: "objectFunction",
				fn: (obj: { name: string }) => ({ ...obj, processed: true }),
			})

			customHub.register({
				name: "noParamFunction",
				fn: () => "constant",
			})

			// Assert
			expect(customHub.execute("stringFunction", "hello")).toBe("HELLO")
			expect(customHub.execute("numberFunction", 2, 3)).toBe(5)
			expect(customHub.execute("objectFunction", { name: "test" })).toEqual({
				name: "test",
				processed: true,
			})
			expect(customHub.execute("noParamFunction")).toBe("constant")
		})
	})
})
