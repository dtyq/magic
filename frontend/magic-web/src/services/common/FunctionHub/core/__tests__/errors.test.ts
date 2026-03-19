import { describe, it, expect } from "vitest"
import {
	FunctionNotFoundError,
	FunctionAlreadyExistsError,
	FunctionExecutionError,
	// @ts-ignore
} from "../errors"

describe("FunctionHub Errors", () => {
	describe("FunctionNotFoundError", () => {
		it("should create error with correct message and name", () => {
			// Arrange
			const functionName = "testFunction"

			// Act
			const error = new FunctionNotFoundError(functionName)

			// Assert
			expect(error).toBeInstanceOf(Error)
			expect(error.name).toBe("FunctionNotFoundError")
			expect(error.message).toBe(`Function '${functionName}' not found in FunctionHub`)
		})

		it("should be throwable and catchable", () => {
			// Arrange
			const functionName = "nonExistent"

			// Act & Assert
			expect(() => {
				throw new FunctionNotFoundError(functionName)
			}).toThrow(FunctionNotFoundError)

			expect(() => {
				throw new FunctionNotFoundError(functionName)
			}).toThrow(`Function '${functionName}' not found in FunctionHub`)
		})
	})

	describe("FunctionAlreadyExistsError", () => {
		it("should create error with correct message and name", () => {
			// Arrange
			const functionName = "duplicateFunction"

			// Act
			const error = new FunctionAlreadyExistsError(functionName)

			// Assert
			expect(error).toBeInstanceOf(Error)
			expect(error.name).toBe("FunctionAlreadyExistsError")
			expect(error.message).toBe(
				`Function '${functionName}' already exists. Use override option to replace it.`,
			)
		})

		it("should be throwable and catchable", () => {
			// Arrange
			const functionName = "existing"

			// Act & Assert
			expect(() => {
				throw new FunctionAlreadyExistsError(functionName)
			}).toThrow(FunctionAlreadyExistsError)

			expect(() => {
				throw new FunctionAlreadyExistsError(functionName)
			}).toThrow(
				`Function '${functionName}' already exists. Use override option to replace it.`,
			)
		})
	})

	describe("FunctionExecutionError", () => {
		it("should create error with correct message and name", () => {
			// Arrange
			const functionName = "failingFunction"
			const originalError = new Error("Original error message")

			// Act
			const error = new FunctionExecutionError(functionName, originalError)

			// Assert
			expect(error).toBeInstanceOf(Error)
			expect(error.name).toBe("FunctionExecutionError")
			expect(error.message).toBe(
				`Error executing function '${functionName}': Original error message`,
			)
			expect(error.cause).toBe(originalError)
		})

		it("should preserve original error as cause", () => {
			// Arrange
			const functionName = "testFunc"
			const originalError = new TypeError("Type error occurred")

			// Act
			const error = new FunctionExecutionError(functionName, originalError)

			// Assert
			expect(error.cause).toBe(originalError)
			expect(error.cause).toBeInstanceOf(TypeError)
		})

		it("should be throwable and catchable", () => {
			// Arrange
			const functionName = "failing"
			const originalError = new Error("Something went wrong")

			// Act & Assert
			expect(() => {
				throw new FunctionExecutionError(functionName, originalError)
			}).toThrow(FunctionExecutionError)

			expect(() => {
				throw new FunctionExecutionError(functionName, originalError)
			}).toThrow(`Error executing function '${functionName}': Something went wrong`)
		})

		it("should handle errors with different message types", () => {
			// Arrange
			const functionName = "testFunction"
			const errorWithUndefinedMessage = new Error()
			const errorWithEmptyMessage = new Error("")

			// Act
			const error1 = new FunctionExecutionError(functionName, errorWithUndefinedMessage)
			const error2 = new FunctionExecutionError(functionName, errorWithEmptyMessage)

			// Assert
			expect(error1.message).toContain(functionName)
			expect(error2.message).toContain(functionName)
		})
	})
})
