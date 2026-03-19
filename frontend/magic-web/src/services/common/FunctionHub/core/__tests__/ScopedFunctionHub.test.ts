import { describe, it, expect, beforeEach } from "vitest"
import { FunctionHub } from "../FunctionHub"
import { ScopedFunctionHub } from "../ScopedFunctionHub"

describe("ScopedFunctionHub", () => {
	let hub: FunctionHub
	let scopedHub: ScopedFunctionHub

	beforeEach(() => {
		hub = new FunctionHub()
		scopedHub = hub.scope("math")
	})

	describe("constructor", () => {
		it("should create scoped hub with correct prefix", () => {
			// Arrange & Act
			const testScope = hub.scope("test")

			// Assert
			expect(testScope).toBeInstanceOf(ScopedFunctionHub)
		})
	})

	describe("register", () => {
		it("should register function with scoped name", () => {
			// Arrange
			const addFn = (a: number, b: number) => a + b

			// Act
			scopedHub.register({
				name: "add",
				fn: addFn,
				description: "Add two numbers",
			})

			// Assert
			expect(hub.has("math.add")).toBe(true)
			expect(scopedHub.has("add")).toBe(true)
			expect(hub.size()).toBe(1)
		})

		it("should allow method chaining", () => {
			// Arrange
			const addFn = (a: number, b: number) => a + b

			// Act
			const result = scopedHub.register({
				name: "add",
				fn: addFn,
			})

			// Assert
			expect(result).toBe(scopedHub)
		})
	})

	describe("inject", () => {
		it("should inject function with scoped name", () => {
			// Arrange
			const originalFn = (x: number) => x * 2
			const newFn = (x: number) => x * 3

			scopedHub.register({ name: "double", fn: originalFn })

			// Act
			scopedHub.inject("double", newFn, "Triple a number")

			// Assert
			expect(hub.has("math.double")).toBe(true)
			expect(scopedHub.has("double")).toBe(true)
		})

		it("should allow method chaining", () => {
			// Arrange
			const testFn = () => "test"

			// Act
			const result = scopedHub.inject("test", testFn)

			// Assert
			expect(result).toBe(scopedHub)
		})
	})

	describe("override", () => {
		it("should override existing scoped function", () => {
			// Arrange
			const originalFn = (x: number) => x * 2
			const newFn = (x: number) => x * 4

			scopedHub.register({ name: "multiply", fn: originalFn })

			// Act
			scopedHub.override("multiply", newFn, "Quadruple a number")

			// Assert
			expect(hub.has("math.multiply")).toBe(true)
			expect(scopedHub.has("multiply")).toBe(true)
		})

		it("should throw error when overriding non-existent function", () => {
			// Act & Assert
			expect(() => {
				scopedHub.override("nonExistent", () => "test")
			}).toThrow()
		})

		it("should allow method chaining", () => {
			// Arrange
			const originalFn = () => "original"
			const newFn = () => "new"

			scopedHub.register({ name: "test", fn: originalFn })

			// Act
			const result = scopedHub.override("test", newFn)

			// Assert
			expect(result).toBe(scopedHub)
		})
	})

	describe("execute", () => {
		it("should execute scoped function", () => {
			// Arrange
			const addFn = (a: number, b: number) => a + b
			scopedHub.register({ name: "add", fn: addFn })

			// Act
			const result = scopedHub.execute("add", 5, 3)

			// Assert
			expect(result).toBe(8)
		})

		it("should throw error when executing non-existent function", () => {
			// Act & Assert
			expect(() => scopedHub.execute("nonExistent")).toThrow()
		})
	})

	describe("has", () => {
		it("should check if scoped function exists", () => {
			// Arrange
			const testFn = () => "test"
			scopedHub.register({ name: "test", fn: testFn })

			// Act & Assert
			expect(scopedHub.has("test")).toBe(true)
			expect(scopedHub.has("nonExistent")).toBe(false)
		})

		it("should check existence using scoped name internally", () => {
			// Arrange
			const testFn = () => "test"
			scopedHub.register({ name: "test", fn: testFn })

			// Act & Assert
			expect(hub.has("math.test")).toBe(true)
			expect(scopedHub.has("test")).toBe(true)
		})
	})

	describe("remove", () => {
		it("should remove scoped function", () => {
			// Arrange
			const testFn = () => "test"
			scopedHub.register({ name: "test", fn: testFn })

			// Act
			const result = scopedHub.remove("test")

			// Assert
			expect(result).toBe(true)
			expect(scopedHub.has("test")).toBe(false)
			expect(hub.has("math.test")).toBe(false)
		})

		it("should return false when removing non-existent function", () => {
			// Act
			const result = scopedHub.remove("nonExistent")

			// Assert
			expect(result).toBe(false)
		})
	})

	describe("getMeta", () => {
		it("should get metadata for scoped function", () => {
			// Arrange
			const testFn = () => "test"
			scopedHub.register({
				name: "test",
				fn: testFn,
				description: "Test function",
			})

			// Act
			const meta = scopedHub.getMeta("test")

			// Assert
			expect(meta).toBeDefined()
			expect(meta?.name).toBe("math.test")
			expect(meta?.description).toBe("Test function")
		})

		it("should return undefined for non-existent function", () => {
			// Act
			const meta = scopedHub.getMeta("nonExistent")

			// Assert
			expect(meta).toBeUndefined()
		})
	})

	describe("namespace isolation", () => {
		it("should isolate functions between different scopes", () => {
			// Arrange
			const mathScope = hub.scope("math")
			const stringScope = hub.scope("string")

			const addFn = (a: number, b: number) => a + b
			const concatFn = (a: string, b: string) => a + b

			// Act
			mathScope.register({ name: "add", fn: addFn })
			stringScope.register({ name: "add", fn: concatFn })

			// Assert
			expect(mathScope.has("add")).toBe(true)
			expect(stringScope.has("add")).toBe(true)
			expect(hub.has("math.add")).toBe(true)
			expect(hub.has("string.add")).toBe(true)
			expect(hub.size()).toBe(2)
		})

		it("should execute correct function in each scope", () => {
			// Arrange
			const mathScope = hub.scope("math")
			const stringScope = hub.scope("string")

			mathScope.register({
				name: "process",
				fn: (x: number) => x * 2,
			})

			stringScope.register({
				name: "process",
				fn: (x: string) => x.toUpperCase(),
			})

			// Act
			const mathResult = mathScope.execute("process", 5)
			const stringResult = stringScope.execute("process", "hello")

			// Assert
			expect(mathResult).toBe(10)
			expect(stringResult).toBe("HELLO")
		})
	})

	describe("nested scoping", () => {
		it("should handle nested scope names correctly", () => {
			// Arrange
			const nestedScope = hub.scope("api.v1.users")
			const getUserFn = (id: number) => ({ id, name: `User${id}` })

			// Act
			nestedScope.register({ name: "getById", fn: getUserFn })

			// Assert
			expect(hub.has("api.v1.users.getById")).toBe(true)
			expect(nestedScope.has("getById")).toBe(true)
		})
	})

	describe("integration with main hub", () => {
		it("should maintain metadata in main hub", () => {
			// Arrange
			const testFn = () => "test"
			scopedHub.register({
				name: "test",
				fn: testFn,
				description: "Test function",
			})

			// Act
			scopedHub.execute("test")
			const meta = hub.getMeta("math.test")

			// Assert
			expect(meta).toBeDefined()
			expect(meta?.executionCount).toBe(1)
			expect(meta?.lastExecuted).toBeInstanceOf(Date)
		})
	})
})
