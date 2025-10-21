import { expect } from "vitest"
import type { NormalSuccessResponse } from "../../src/types"
import { PlatformType } from "../../src/types"

/**
 * Assert that upload was successful with expected response format
 */
export function expectUploadSuccess(
	result: NormalSuccessResponse,
	platform: PlatformType,
	path?: string
) {
	expect(result).toBeDefined()
	expect(result).toHaveProperty("code", 1000)
	expect(result).toHaveProperty("data")
	expect(result.data).toHaveProperty("platform", platform)
	
	if (path) {
		expect(result.data).toHaveProperty("path", path)
	}
}

/**
 * Assert that a function throws a specific exception
 */
export function expectThrowsException(
	fn: () => void,
	exceptionClass: any,
	...messagePatterns: (string | RegExp)[]
) {
	expect(fn).toThrow()
	
	try {
		fn()
	} catch (error) {
		expect(error).toBeInstanceOf(exceptionClass)
		
		if (messagePatterns.length > 0) {
			const errorMessage = (error as Error).message
			messagePatterns.forEach(pattern => {
				if (typeof pattern === "string") {
					expect(errorMessage).toContain(pattern)
				} else {
					expect(errorMessage).toMatch(pattern)
				}
			})
		}
	}
}

/**
 * Assert that a promise rejects with a specific exception
 */
export async function expectRejectsWithException(
	promise: Promise<any>,
	exceptionClass: any,
	...messagePatterns: (string | RegExp)[]
) {
	await expect(promise).rejects.toThrow()
	
	try {
		await promise
	} catch (error) {
		expect(error).toBeInstanceOf(exceptionClass)
		
		if (messagePatterns.length > 0) {
			const errorMessage = (error as Error).message
			messagePatterns.forEach(pattern => {
				if (typeof pattern === "string") {
					expect(errorMessage).toContain(pattern)
				} else {
					expect(errorMessage).toMatch(pattern)
				}
			})
		}
	}
}

/**
 * Assert progress callback is called with valid values
 */
export function expectValidProgress(
	percent: number,
	loaded: number,
	total: number
) {
	expect(percent).toBeGreaterThanOrEqual(0)
	expect(percent).toBeLessThanOrEqual(100)
	expect(loaded).toBeGreaterThanOrEqual(0)
	expect(loaded).toBeLessThanOrEqual(total)
	expect(total).toBeGreaterThan(0)
}

/**
 * Assert that response has required fields
 */
export function expectValidResponse(response: any) {
	expect(response).toBeDefined()
	expect(response).toHaveProperty("code")
	expect(response).toHaveProperty("data")
}

/**
 * Assert that error has expected structure
 */
export function expectValidError(error: any, expectedCode?: number) {
	expect(error).toBeDefined()
	expect(error).toHaveProperty("message")
	
	if (expectedCode !== undefined) {
		expect(error).toHaveProperty("status", expectedCode)
	}
}

