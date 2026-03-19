import { describe, it, expect, beforeEach } from "vitest"
import { FunctionHub } from "../index"

describe("FunctionHub Integration Tests", () => {
	let hub: FunctionHub

	beforeEach(() => {
		hub = new FunctionHub()
	})

	describe("Basic integration scenarios", () => {
		it("should handle simple function registration and execution", () => {
			// Arrange
			const mathScope = hub.scope("math")

			mathScope.register({
				name: "add",
				fn: (a: number, b: number) => a + b,
				description: "Add two numbers",
			})

			mathScope.register({
				name: "multiply",
				fn: (a: number, b: number) => a * b,
				description: "Multiply two numbers",
			})

			// Act
			const addResult = mathScope.execute("add", 5, 3)
			const multiplyResult = mathScope.execute("multiply", 4, 6)

			// Assert
			expect(addResult).toBe(8)
			expect(multiplyResult).toBe(24)
			expect(hub.size()).toBe(2)
			expect(hub.has("math.add")).toBe(true)
			expect(hub.has("math.multiply")).toBe(true)
		})

		it("should handle functions with error handling", () => {
			// Arrange
			hub.register({
				name: "successFunction",
				fn: (value: string) => `processed: ${value}`,
			})

			hub.register({
				name: "errorFunction",
				fn: () => {
					throw new Error("Function failed")
				},
			})

			// Act & Assert
			const successResult = hub.execute("successFunction", "hello")
			expect(successResult).toBe("processed: hello")

			expect(() => hub.execute("errorFunction")).toThrow("Function failed")
		})
	})

	describe("Scoped operations", () => {
		it("should handle multiple scopes without interference", () => {
			// Arrange
			const userScope = hub.scope("user")
			const adminScope = hub.scope("admin")

			userScope.register({
				name: "getProfile",
				fn: (id: string) => ({ id, role: "user", permissions: ["read"] }),
			})

			adminScope.register({
				name: "getProfile",
				fn: (id: string) => ({
					id,
					role: "admin",
					permissions: ["read", "write", "delete"],
				}),
			})

			// Act
			const userProfile = userScope.execute("getProfile", "123")
			const adminProfile = adminScope.execute("getProfile", "456")

			// Assert
			expect(userProfile.role).toBe("user")
			expect(userProfile.permissions).toHaveLength(1)

			expect(adminProfile.role).toBe("admin")
			expect(adminProfile.permissions).toHaveLength(3)

			expect(hub.size()).toBe(2)
			expect(hub.has("user.getProfile")).toBe(true)
			expect(hub.has("admin.getProfile")).toBe(true)
		})

		it("should handle nested scopes", () => {
			// Arrange
			const apiV1Users = hub.scope("api.v1.users")
			const apiV2Users = hub.scope("api.v2.users")

			apiV1Users.register({
				name: "list",
				fn: () => ({ version: "v1", users: ["alice", "bob"] }),
			})

			apiV2Users.register({
				name: "list",
				fn: () => ({ version: "v2", users: [{ name: "alice" }, { name: "bob" }] }),
			})

			// Act
			const v1Result = apiV1Users.execute("list")
			const v2Result = apiV2Users.execute("list")

			// Assert
			expect(v1Result.version).toBe("v1")
			expect(v2Result.version).toBe("v2")
			expect(Array.isArray(v1Result.users)).toBe(true)
			expect(typeof v2Result.users[0]).toBe("object")

			expect(hub.has("api.v1.users.list")).toBe(true)
			expect(hub.has("api.v2.users.list")).toBe(true)
		})
	})

	describe("Function lifecycle management", () => {
		it("should handle function override and removal", () => {
			// Arrange
			hub.register({
				name: "calculator",
				fn: (a: number, b: number) => a + b,
				description: "Simple addition",
			})

			// Act - Initial execution
			const result1 = hub.execute("calculator", 2, 3)

			// Override with new implementation
			hub.override("calculator", (a: number, b: number) => a * b, "Changed to multiplication")
			const result2 = hub.execute("calculator", 2, 3)

			// Remove function
			const removed = hub.remove("calculator")

			// Assert
			expect(result1).toBe(5) // Addition
			expect(result2).toBe(6) // Multiplication
			expect(removed).toBe(true)
			expect(hub.has("calculator")).toBe(false)
			expect(hub.size()).toBe(0)
		})

		it("should handle batch operations", () => {
			// Arrange
			const functions = [
				{ name: "func1", fn: () => 1 },
				{ name: "func2", fn: () => 2 },
				{ name: "func3", fn: () => 3 },
			]

			// Act
			hub.batch(functions)

			// Assert
			expect(hub.size()).toBe(3)
			expect(hub.getNames()).toEqual(["func1", "func2", "func3"])

			const allMeta = hub.getAllMeta()
			expect(allMeta).toHaveLength(3)
			expect(allMeta.every((meta) => meta.executionCount === 0)).toBe(true)
		})
	})

	describe("Error scenarios", () => {
		it("should handle various error types consistently", () => {
			// Arrange
			hub.register({
				name: "throwError",
				fn: () => {
					throw new Error("Test error")
				},
			})

			// Act & Assert
			expect(() => hub.execute("throwError")).toThrow()
			expect(() => hub.execute("nonExistent")).toThrow()

			expect(() => {
				hub.register({ name: "throwError", fn: () => "duplicate" })
			}).toThrow()

			expect(() => {
				hub.override("nonExistent", () => "test")
			}).toThrow()
		})
	})

	describe("Performance and metadata tracking", () => {
		it("should track execution metadata correctly", () => {
			// Arrange
			hub.register({
				name: "tracked",
				fn: (value: string) => value.toUpperCase(),
				description: "Uppercase conversion",
			})

			// Act
			hub.execute("tracked", "hello")
			hub.execute("tracked", "world")

			// Assert
			const meta = hub.getMeta("tracked")
			expect(meta).toBeDefined()
			expect(meta?.name).toBe("tracked")
			expect(meta?.description).toBe("Uppercase conversion")
			expect(meta?.executionCount).toBe(2)
			expect(meta?.lastExecuted).toBeInstanceOf(Date)
			expect(meta?.registeredAt).toBeInstanceOf(Date)
		})

		it("should maintain separate metadata for scoped functions", () => {
			// Arrange
			const scope1 = hub.scope("scope1")
			const scope2 = hub.scope("scope2")

			scope1.register({ name: "func", fn: () => "scope1" })
			scope2.register({ name: "func", fn: () => "scope2" })

			// Act
			scope1.execute("func")
			scope1.execute("func")
			scope2.execute("func")

			// Assert
			const meta1 = scope1.getMeta("func")
			const meta2 = scope2.getMeta("func")

			expect(meta1?.name).toBe("scope1.func")
			expect(meta1?.executionCount).toBe(2)

			expect(meta2?.name).toBe("scope2.func")
			expect(meta2?.executionCount).toBe(1)
		})
	})

	describe("Type safety and function execution", () => {
		it("should handle different function signatures correctly", () => {
			// Arrange
			hub.register({
				name: "stringProcessor",
				fn: (input: string) => input.toUpperCase(),
			})

			hub.register({
				name: "numberCalculator",
				fn: (a: number, b: number, c: number) => a + b * c,
			})

			hub.register({
				name: "objectHandler",
				fn: (obj: { name: string; age: number }) => ({
					...obj,
					description: `${obj.name} is ${obj.age} years old`,
				}),
			})

			// Act
			const stringResult = hub.execute("stringProcessor", "hello")
			const numberResult = hub.execute("numberCalculator", 1, 2, 3)
			const objectResult = hub.execute("objectHandler", { name: "Alice", age: 25 })

			// Assert
			expect(stringResult).toBe("HELLO")
			expect(numberResult).toBe(7)
			expect(objectResult.description).toBe("Alice is 25 years old")
		})

		it("should handle functions with no parameters", () => {
			// Arrange
			hub.register({
				name: "getCurrentTime",
				fn: () => Date.now(),
			})

			hub.register({
				name: "getRandomNumber",
				fn: () => Math.random(),
			})

			// Act
			const time = hub.execute("getCurrentTime")
			const random = hub.execute("getRandomNumber")

			// Assert
			expect(typeof time).toBe("number")
			expect(typeof random).toBe("number")
			expect(random).toBeGreaterThanOrEqual(0)
			expect(random).toBeLessThan(1)
		})
	})
})
