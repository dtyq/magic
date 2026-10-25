import { describe, expect, it, vi } from "vitest"
import { createRecord } from "../record"
import { Deduplicator } from "../deduplicate"
import { byteLength, safeSnapshot } from "../snapshot"

describe("Error diagnostic snapshots", () => {
	it("preserves native Error identity, empty messages and native stacks", () => {
		const error = new RangeError("Position 5 out of range")
		expect(safeSnapshot(error)).toMatchObject({
			name: "RangeError",
			message: error.message,
			stack: error.stack,
		})
		expect(safeSnapshot(new Error())).toMatchObject({ name: "Error", message: "" })
	})

	it("reads inherited Error diagnostics and stack accessors before redaction", () => {
		class InheritedError extends Error {}
		Object.defineProperties(InheritedError.prototype, {
			name: { value: "InheritedError" },
			message: { value: "request failed token=private-token" },
		})
		const error = new InheritedError()
		const stack = vi.fn(
			() => "InheritedError: failed\n at https://example.com/?token=stack-secret",
		)
		Object.defineProperty(error, "stack", { get: stack })
		expect(safeSnapshot(error)).toMatchObject({
			name: "InheritedError",
			message: "request failed token=[REDACTED]",
			stack: "InheritedError: failed\n at https://example.com/?token=[REDACTED]",
		})
		expect(stack).toHaveBeenCalledTimes(1)
	})

	it("contains throwing Error accessors and still records the other fields", () => {
		const error = new TypeError("broken")
		Object.defineProperty(error, "stack", {
			get() {
				throw new Error("unreadable")
			},
		})
		expect(safeSnapshot(error)).toMatchObject({
			name: "TypeError",
			message: "broken",
			stack: "[Unreadable]",
		})
	})

	it("never reads ordinary object, code or cause getters or calls toJSON", () => {
		const getter = vi.fn(() => "unsafe")
		const toJSON = vi.fn(() => "unsafe")
		const plain = Object.defineProperty({ toJSON }, "stack", { get: getter, enumerable: true })
		const error = new Error("safe")
		Object.defineProperties(error, { code: { get: getter }, cause: { get: getter } })
		expect(safeSnapshot(plain)).toMatchObject({ stack: "[Accessor]" })
		expect(safeSnapshot(error)).toMatchObject({ code: "[Accessor]", cause: "[Accessor]" })
		expect(getter).not.toHaveBeenCalled()
		expect(toJSON).not.toHaveBeenCalled()
	})

	it("bounds Error stacks and contains circular causes", () => {
		const error = Object.assign(new Error("broken"), { cause: undefined as unknown })
		error.cause = error
		Object.defineProperty(error, "stack", { get: () => "汉😀".repeat(100000) })
		const snapshot = safeSnapshot(error) as {
			value: Record<string, unknown>
			truncation: unknown
		}
		expect(snapshot.truncation).toEqual({ reason: "record_budget" })
		expect(snapshot.value.cause).toBe("[Circular]")
		expect(byteLength(snapshot.value.stack as string)).toBeLessThanOrEqual(4096)
	})

	it("does not coerce invalid diagnostic objects or read their getters", () => {
		const toString = vi.fn(() => "unsafe")
		const error = new Error("broken")
		Object.defineProperty(error, "stack", { get: () => ({ toString }) })
		expect(safeSnapshot(error)).toMatchObject({ stack: "[Invalid Error field]" })
		expect(toString).not.toHaveBeenCalled()
	})

	it("keeps errors with different business stacks distinct during deduplication", () => {
		const dedup = new Deduplicator(vi.fn(), vi.fn())
		const records = ["Editor", "Preview"].map((component) => {
			const error = new Error("broken")
			Object.defineProperty(error, "stack", {
				get: () => `Error: broken\n at ${component}.render (component.js:10:5)`,
			})
			return createRecord(
				"error",
				{ data: { eventKey: "render_failed", errorKind: "render", error } },
				{},
				"session",
				"release",
			)
		})
		expect(dedup.accept(records[0])).toBe(true)
		expect(dedup.accept(records[1])).toBe(true)
		expect(dedup.accept(records[0])).toBe(false)
	})

	it("keeps boundary wire fields searchable when optional component context is too large", () => {
		const error = new Error()
		Object.defineProperty(error, "stack", {
			get: () => "Error\n at Editor.render (editor.js:10:5)",
		})
		const record = createRecord(
			"error",
			{
				namespace: "MessageRenderErrorBoundary",
				data: {
					eventKey: "message_render_failed",
					errorKind: "render",
					error,
					context: { componentStack: "component\n".repeat(10000) },
				},
			},
			{},
			"session",
			"release",
		)
		expect(record).toMatchObject({
			eventKey: "message_render_failed",
			captureSource: "manual",
			syntheticError: false,
			error: {
				name: "Error",
				message: "",
				stack: "Error\n at Editor.render (editor.js:10:5)",
			},
			truncation: { reason: "record_budget" },
		})
		expect(byteLength(JSON.stringify(record))).toBeLessThanOrEqual(32768)
	})
})
