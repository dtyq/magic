import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePPTNotesAI } from "../usePPTNotesAI"
const input = { fileId: "one", draft: "draft", rawContent: "slide", enabled: true }
function deferred() {
	let resolve!: (value: string) => void
	const promise = new Promise<string>((done) => {
		resolve = done
	})
	return { promise, resolve }
}
describe("notes AI lifecycle", () => {
	it.each(["draft", "rawContent", "fileId"] as const)(
		"rejects stale results after %s changes",
		async (field) => {
			const pending = deferred()
			const generate = vi.fn(() => pending.promise)
			const { result, rerender } = renderHook(
				(props) => usePPTNotesAI({ ...props, generate }),
				{ initialProps: input },
			)
			let response!: Promise<string | undefined>
			act(() => {
				response = result.current.run("polish")
			})
			rerender({ ...input, [field]: "changed" })
			await act(async () => {
				pending.resolve("AI result")
				expect(await response).toBeUndefined()
			})
		},
	)
	it("cancels and permits a new request without an old completion resetting its state", async () => {
		const first = deferred(),
			second = deferred()
		const generate = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise)
		const { result } = renderHook(() => usePPTNotesAI({ ...input, generate }))
		let old!: Promise<string | undefined>, fresh!: Promise<string | undefined>
		act(() => {
			old = result.current.run("polish")
		})
		act(() => result.current.cancel())
		act(() => {
			fresh = result.current.run("shorten")
		})
		await act(async () => {
			first.resolve("old")
			expect(await old).toBeUndefined()
		})
		expect(result.current.busy).toBe(true)
		await act(async () => {
			second.resolve("fresh")
			expect(await fresh).toBe("fresh")
		})
		expect(result.current.busy).toBe(false)
	})
	it("prevents duplicate requests and reports failure", async () => {
		const generate = vi.fn().mockRejectedValue(new Error("network"))
		const { result } = renderHook(() => usePPTNotesAI({ ...input, generate }))
		await act(async () => {
			await Promise.all([result.current.run("polish"), result.current.run("polish")])
		})
		expect(generate).toHaveBeenCalledTimes(1)
		expect(result.current.error).toBe("failed")
	})
})
