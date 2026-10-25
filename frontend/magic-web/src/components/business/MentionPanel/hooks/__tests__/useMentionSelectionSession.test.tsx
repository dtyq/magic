import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MentionItemType, PanelState } from "../../types"
import type { MentionItem } from "../../types"
import { useMentionSelectionSession } from "../useMentionSelectionSession"

const fileOne: MentionItem = {
	id: "file-1",
	name: "File 1",
	type: MentionItemType.PROJECT_FILE,
}

const rootNavigation = [{ id: "root", name: "Root", state: PanelState.CATALOG }]

function useSession(options: {
	navigationKey: string
	scopeId?: string
	policy: "clear" | "preserve"
	prepareItem?: (item: MentionItem) => Promise<{ canSelect: boolean }>
}) {
	return useMentionSelectionSession({
		enabled: true,
		canToggleItem: () => true,
		navigationStack: rootNavigation,
		navigationKey: options.navigationKey,
		navigationPolicy: options.policy,
		scopeId: options.scopeId,
		prepareItem: options.prepareItem,
	})
}

describe("useMentionSelectionSession", () => {
	it("preserves selections across navigation but clears them when the scope changes", async () => {
		const { result, rerender } = renderHook(
			(props: { navigationKey: string; scopeId?: string }) =>
				useSession({ ...props, policy: "preserve" }),
			{ initialProps: { navigationKey: "root", scopeId: "canvas-a" } },
		)

		await act(async () => {
			await result.current.togglePendingForItem(fileOne)
		})
		expect(result.current.pendingEntries).toHaveLength(1)

		rerender({ navigationKey: "root/folder-a", scopeId: "canvas-a" })
		await waitFor(() => expect(result.current.pendingEntries).toHaveLength(1))

		rerender({ navigationKey: "root/folder-a", scopeId: "canvas-b" })
		await waitFor(() => expect(result.current.pendingEntries).toHaveLength(0))
	})

	it("clears selections on navigation with the default policy", async () => {
		const { result, rerender } = renderHook(
			(props: { navigationKey: string }) => useSession({ ...props, policy: "clear" }),
			{ initialProps: { navigationKey: "root" } },
		)

		await act(async () => {
			await result.current.togglePendingForItem(fileOne)
		})
		expect(result.current.pendingEntries).toHaveLength(1)

		rerender({ navigationKey: "root/folder-a" })
		await waitFor(() => expect(result.current.pendingEntries).toHaveLength(0))
	})

	it("does not resurrect a selection after navigation clears an in-flight preparation", async () => {
		let resolvePreparation: ((value: { canSelect: boolean }) => void) | undefined
		const preparation = new Promise<{ canSelect: boolean }>((resolve) => {
			resolvePreparation = resolve
		})
		const { result, rerender } = renderHook(
			(props: { navigationKey: string }) =>
				useSession({
					...props,
					policy: "clear",
					prepareItem: () => preparation,
				}),
			{ initialProps: { navigationKey: "root" } },
		)

		let togglePromise: Promise<boolean> | undefined
		act(() => {
			togglePromise = result.current.togglePendingForItem(fileOne)
		})
		rerender({ navigationKey: "root/folder-a" })
		resolvePreparation?.({ canSelect: true })
		await act(async () => {
			await togglePromise
		})

		expect(result.current.pendingEntries).toHaveLength(0)
	})
})
