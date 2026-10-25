import { describe, expect, it, vi } from "vitest"
import { guardMenuItems, runGuardedAction } from "../actionGuard"

describe("runGuardedAction", () => {
	it("runs the action when no guard is provided", async () => {
		const action = vi.fn()

		await expect(runGuardedAction(undefined, action)).resolves.toBe(true)
		expect(action).toHaveBeenCalledOnce()
	})

	it("does not run the action when the guard rejects it", async () => {
		const action = vi.fn()

		await expect(runGuardedAction(() => false, action)).resolves.toBe(false)
		expect(action).not.toHaveBeenCalled()
	})

	it("waits for an asynchronous guard before running the action", async () => {
		const calls: string[] = []

		await expect(
			runGuardedAction(
				async () => {
					calls.push("guard")
					return true
				},
				() => {
					calls.push("action")
				},
			),
		).resolves.toBe(true)
		expect(calls).toEqual(["guard", "action"])
	})
})

describe("guardMenuItems", () => {
	it("guards nested menu item callbacks", async () => {
		const action = vi.fn()
		const items = guardMenuItems(
			[
				{
					key: "parent",
					label: "Parent",
					children: [{ key: "child", label: "Child", onClick: action }],
				},
			],
			() => false,
		)
		const parent = items?.[0]
		const child = parent && "children" in parent ? parent.children?.[0] : undefined

		if (!child || !("onClick" in child) || !child.onClick) {
			throw new Error("Expected a guarded child menu item")
		}
		child.onClick({} as Parameters<NonNullable<typeof child.onClick>>[0])
		await Promise.resolve()

		expect(action).not.toHaveBeenCalled()
	})
})
