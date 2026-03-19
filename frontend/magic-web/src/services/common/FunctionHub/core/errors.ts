/**
 * Custom error classes for FunctionHub
 */

export class FunctionNotFoundError extends Error {
	constructor(name: string) {
		super(`Function '${name}' not found in FunctionHub`)
		this.name = "FunctionNotFoundError"
	}
}

export class FunctionAlreadyExistsError extends Error {
	constructor(name: string) {
		super(`Function '${name}' already exists. Use override option to replace it.`)
		this.name = "FunctionAlreadyExistsError"
	}
}

export class FunctionExecutionError extends Error {
	constructor(name: string, originalError: Error) {
		super(`Error executing function '${name}': ${originalError.message}`)
		this.name = "FunctionExecutionError"
		this.cause = originalError
	}
}
