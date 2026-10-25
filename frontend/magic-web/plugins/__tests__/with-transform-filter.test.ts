import { describe, expect, test, vi } from "vitest"
import { withTransformFilter } from "../with-transform-filter"

describe("withTransformFilter", () => {
	test("moves the function hook into handler and keeps the rest of the plugin", () => {
		const transform = vi.fn()
		const plugin = { name: "third-party", enforce: "pre" as const, transform }
		const filter = { code: /react/ }

		const wrapped = withTransformFilter(plugin, filter)

		expect(wrapped).toMatchObject({ name: "third-party", enforce: "pre" })
		expect(wrapped.transform).toEqual({ filter, handler: transform })
	})

	test("rejects plugins without a function transform", () => {
		expect(() => withTransformFilter({ name: "no-transform" }, { code: /x/ })).toThrow(
			"no function transform",
		)
	})
})
