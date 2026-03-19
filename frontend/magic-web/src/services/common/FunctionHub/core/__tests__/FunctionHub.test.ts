import { describe, it, expect, beforeEach } from "vitest"
// @ts-ignore
import { FunctionHub } from "../FunctionHub"
import {
	FunctionNotFoundError,
	FunctionAlreadyExistsError,
	FunctionExecutionError,
} from "../errors"

describe("FunctionHub", () => {
	let hub: FunctionHub

	beforeEach(() => {
		hub = new FunctionHub()
	})

	describe("constructor", () => {
		it("should create instance with default options", () => {
			// Arrange & Act
			const defaultHub = new FunctionHub()

			// Assert
			expect(defaultHub).toBeInstanceOf(FunctionHub)
			expect(defaultHub.size()).toBe(0)
		})

		it("should create instance with custom options", () => {
			// Arrange
			const options = {
				enableMetrics: false,
			}

			// Act
			const customHub = new FunctionHub(options)

			// Assert
			expect(customHub).toBeInstanceOf(FunctionHub)
			expect(customHub.size()).toBe(0)
		})
	})

	describe("register", () => {
		it("should register a new function", () => {
			// Arrange
			const testFn = (x: number) => x * 2
			const definition = {
				name: "double",
				fn: testFn,
				description: "Doubles a number",
			}

			// Act
			const result = hub.register(definition)

			// Assert
			expect(result).toBe(hub) // Should return this for chaining
			expect(hub.has("double")).toBe(true)
			expect(hub.size()).toBe(1)
		})

		it("should throw error when registering existing function without override", () => {
			// Arrange
			const testFn = () => "test"
			hub.register({ name: "existing", fn: testFn })

			// Act & Assert
			expect(() => {
				hub.register({ name: "existing", fn: testFn })
			}).toThrow(FunctionAlreadyExistsError)
		})

		it("should allow overriding existing function with override flag", () => {
			// Arrange
			const originalFn = () => "original"
			const newFn = () => "new"
			hub.register({ name: "test", fn: originalFn })

			// Act
			hub.register({ name: "test", fn: newFn, override: true })

			// Assert
			expect(hub.has("test")).toBe(true)
			expect(hub.size()).toBe(1)
		})

		it("should store metadata when metrics enabled", () => {
			// Arrange
			const testFn = () => "test"
			const definition = {
				name: "testFunc",
				fn: testFn,
				description: "Test function",
			}

			// Act
			hub.register(definition)
			const meta = hub.getMeta("testFunc")

			// Assert
			expect(meta).toBeDefined()
			expect(meta?.name).toBe("testFunc")
			expect(meta?.description).toBe("Test function")
			expect(meta?.executionCount).toBe(0)
			expect(meta?.registeredAt).toBeInstanceOf(Date)
		})
	})

	describe("inject", () => {
		it("should inject function (alias for register with override)", () => {
			// Arrange
			const originalFn = () => "original"
			const newFn = () => "injected"
			hub.register({ name: "test", fn: originalFn })

			// Act
			const result = hub.inject("test", newFn, "Injected function")

			// Assert
			expect(result).toBe(hub)
			expect(hub.has("test")).toBe(true)
		})
	})

	describe("override", () => {
		it("should override existing function", () => {
			// Arrange
			const originalFn = () => "original"
			const newFn = () => "overridden"
			hub.register({ name: "test", fn: originalFn })

			// Act
			const result = hub.override("test", newFn, "Overridden function")

			// Assert
			expect(result).toBe(hub)
			expect(hub.has("test")).toBe(true)
		})

		it("should throw error when overriding non-existent function", () => {
			// Arrange
			const newFn = () => "new"

			// Act & Assert
			expect(() => {
				hub.override("nonExistent", newFn)
			}).toThrow(FunctionNotFoundError)
		})
	})

	describe("execute", () => {
		it("should execute registered function", () => {
			// Arrange
			const testFn = (x: number, y: number) => x + y
			hub.register({ name: "add", fn: testFn })

			// Act
			const result = hub.execute("add", 5, 3)

			// Assert
			expect(result).toBe(8)
		})

		it("should throw error when executing non-existent function", () => {
			// Act & Assert
			expect(() => hub.execute("nonExistent")).toThrow(FunctionNotFoundError)
		})

		it("should update execution metadata", () => {
			// Arrange
			const testFn = () => "test"
			hub.register({ name: "test", fn: testFn })

			// Act
			hub.execute("test")
			const meta = hub.getMeta("test")

			// Assert
			expect(meta?.executionCount).toBe(1)
			expect(meta?.lastExecuted).toBeInstanceOf(Date)
		})

		it("should wrap execution errors in FunctionExecutionError", () => {
			// Arrange
			const errorFn = () => {
				throw new Error("Function failed")
			}
			hub.register({ name: "errorTest", fn: errorFn })

			// Act & Assert
			expect(() => hub.execute("errorTest")).toThrow(FunctionExecutionError)
		})
	})

	describe("remove", () => {
		it("should remove existing function", () => {
			// Arrange
			const testFn = () => "test"
			hub.register({ name: "test", fn: testFn })

			// Act
			const result = hub.remove("test")

			// Assert
			expect(result).toBe(true)
			expect(hub.has("test")).toBe(false)
			expect(hub.size()).toBe(0)
		})

		it("should return false when removing non-existent function", () => {
			// Act
			const result = hub.remove("nonExistent")

			// Assert
			expect(result).toBe(false)
		})

		it("should remove metadata when function is removed", () => {
			// Arrange
			const testFn = () => "test"
			hub.register({ name: "test", fn: testFn })

			// Act
			hub.remove("test")

			// Assert
			expect(hub.getMeta("test")).toBeUndefined()
		})
	})

	describe("query methods", () => {
		beforeEach(() => {
			hub.register({ name: "func1", fn: () => 1 })
			hub.register({ name: "func2", fn: () => 2, description: "Second function" })
		})

		it("should check if function exists", () => {
			// Act & Assert
			expect(hub.has("func1")).toBe(true)
			expect(hub.has("nonExistent")).toBe(false)
		})

		it("should get all function names", () => {
			// Act
			const names = hub.getNames()

			// Assert
			expect(names).toContain("func1")
			expect(names).toContain("func2")
			expect(names).toHaveLength(2)
		})

		it("should get function metadata", () => {
			// Act
			const meta1 = hub.getMeta("func1")
			const meta2 = hub.getMeta("func2")
			const metaNonExistent = hub.getMeta("nonExistent")

			// Assert
			expect(meta1).toBeDefined()
			expect(meta1?.name).toBe("func1")
			expect(meta2?.description).toBe("Second function")
			expect(metaNonExistent).toBeUndefined()
		})

		it("should get all metadata", () => {
			// Act
			const allMeta = hub.getAllMeta()

			// Assert
			expect(allMeta).toHaveLength(2)
			expect(allMeta.map((m) => m.name)).toContain("func1")
			expect(allMeta.map((m) => m.name)).toContain("func2")
		})

		it("should return correct size", () => {
			// Act & Assert
			expect(hub.size()).toBe(2)

			hub.remove("func1")
			expect(hub.size()).toBe(1)
		})
	})

	describe("clear", () => {
		it("should clear all functions and metadata", () => {
			// Arrange
			hub.register({ name: "func1", fn: () => 1 })
			hub.register({ name: "func2", fn: () => 2 })

			// Act
			const result = hub.clear()

			// Assert
			expect(result).toBe(hub)
			expect(hub.size()).toBe(0)
			expect(hub.getNames()).toHaveLength(0)
			expect(hub.getAllMeta()).toHaveLength(0)
		})
	})

	describe("batch", () => {
		it("should register multiple functions at once", () => {
			// Arrange
			const definitions = [
				{ name: "add", fn: (a: number, b: number) => a + b },
				{ name: "multiply", fn: (a: number, b: number) => a * b },
				{ name: "divide", fn: (a: number, b: number) => a / b },
			]

			// Act
			const result = hub.batch(definitions)

			// Assert
			expect(result).toBe(hub)
			expect(hub.size()).toBe(3)
			expect(hub.has("add")).toBe(true)
			expect(hub.has("multiply")).toBe(true)
			expect(hub.has("divide")).toBe(true)
		})
	})

	describe("scope", () => {
		it("should create scoped function hub", () => {
			// Act
			const mathScope = hub.scope("math")

			// Assert
			expect(mathScope).toBeDefined()
			expect(mathScope).toHaveProperty("register")
			expect(mathScope).toHaveProperty("execute")
		})
	})
})
