import { describe, expect, it } from "vitest"
import { appendQueryParams, type QueryParams } from "@/infrastructure/network/http/query"

describe("appendQueryParams", () => {
	it("encodes raw values and preserves empty strings, zero and false", () => {
		expect(
			appendQueryParams("/items", {
				keyword: "a&b c+中文",
				empty: "",
				zero: 0,
				enabled: false,
				nil: null,
				missing: undefined,
			}),
		).toBe("/items?keyword=a%26b+c%2B%E4%B8%AD%E6%96%87&empty=&zero=0&enabled=false")
	})

	it("expands readonly arrays with brackets and skips nullish items", () => {
		const params = { ids: [1, null, undefined, 0, false, ""], empty: [] } as const
		expect(appendQueryParams("/items", params)).toBe(
			"/items?ids%5B%5D=1&ids%5B%5D=0&ids%5B%5D=false&ids%5B%5D=",
		)
		expect(params.ids).toEqual([1, null, undefined, 0, false, ""])
	})

	it("appends before the hash without rewriting existing query encoding", () => {
		expect(appendQueryParams("/items?q=a%20b&ids[]=old#section?x", { ids: [2] })).toBe(
			"/items?q=a%20b&ids[]=old&ids%5B%5D=2#section?x",
		)
	})

	it.each(["/items", "items", "https://other.test/items", "//other.test/items"])(
		"preserves the URL form of %s",
		(url) => {
			expect(appendQueryParams(`${url}#section`, { page: 1 })).toBe(`${url}?page=1#section`)
		},
	)

	it.each([undefined, {}, { nil: null, missing: undefined, empty: [] }])(
		"leaves the original URL untouched when there are no serialized values: %j",
		(params) => {
			const url = "/items?key=a%20b#section"
			expect(appendQueryParams(url, params)).toBe(url)
		},
	)

	it.each(["/items?", "/items?old=1&"])("handles trailing separators in %s", (url) => {
		expect(appendQueryParams(url, { page: 1 })).toBe(`${url}page=1`)
	})

	it("omits object values and object array items while preserving valid params", () => {
		const params = {
			location: { city: "example" },
			repeat_rule: {},
			ids: [1, { id: 2 }, null, undefined, [3], false, ""],
			page: 0,
		} as unknown as QueryParams
		expect(appendQueryParams("/items", params)).toBe(
			"/items?ids%5B%5D=1&ids%5B%5D=false&ids%5B%5D=&page=0",
		)
	})

	it.each([NaN, Infinity, -Infinity, [NaN]])(
		"rejects unsupported values instead of silently stringifying them: %j",
		(value) => {
			// Simulate untyped callers bypassing the public params contract.
			expect(() => appendQueryParams("/items", { value } as unknown as QueryParams)).toThrow(
				TypeError,
			)
		},
	)
})
