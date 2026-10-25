import { describe, expect, it } from "vitest"
import { stringifyUnknownError } from "../error"

describe("stringifyUnknownError", () => {
	it("serializes plain objects as JSON instead of [object Object]", () => {
		expect(stringifyUnknownError({ code: 403, message: "forbidden" })).toBe(
			'{"code":403,"message":"forbidden"}',
		)
	})

	it("keeps Error messages readable", () => {
		expect(stringifyUnknownError(new Error("download failed"))).toBe("download failed")
	})

	it("keeps circular values valid JSON", () => {
		const error: Record<string, unknown> = { code: 500 }
		error.details = error

		expect(stringifyUnknownError(error)).toBe('{"code":500,"details":"[Circular]"}')
	})
})
