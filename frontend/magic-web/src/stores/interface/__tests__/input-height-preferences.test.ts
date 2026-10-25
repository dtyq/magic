// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { InterfaceStore } from ".."

/** Provide deterministic browser-like persistence without relying on the Node localStorage flag. */
function createMemoryStorage(): Storage {
	const values = new Map<string, string>()
	return {
		get length() {
			return values.size
		},
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		key: (index) => Array.from(values.keys())[index] ?? null,
		removeItem: (key) => values.delete(key),
		setItem: (key, value) => values.set(key, value),
	}
}

describe("InterfaceStore input height preferences", () => {
	beforeEach(() => {
		vi.stubGlobal("localStorage", createMemoryStorage())
	})

	it("stores manual height independently for each conversation scope", () => {
		const store = new InterfaceStore()
		store.setChatInputHeightPreference("topic-page", {
			mode: "manual",
			height: 320,
		})
		store.setChatInputHeightPreference("crew-topic-panel", {
			mode: "auto",
			height: 280,
		})

		expect(store.getChatInputHeightPreference("topic-page")).toEqual({
			mode: "manual",
			height: 320,
		})
		expect(store.getChatInputHeightPreference("crew-topic-panel")).toEqual({
			mode: "auto",
			height: 280,
		})
		expect(store.chatInputDefaultHeight).toBe(240)
	})

	it("migrates legacy height data to an automatic scoped fallback", () => {
		const seedStore = new InterfaceStore()
		localStorage.setItem(
			seedStore.chatPanelSizeKey,
			JSON.stringify({
				chatInputDefaultHeight: 300,
				chatSiderDefaultWidth: 260,
			}),
		)

		const restoredStore = new InterfaceStore()
		expect(restoredStore.getChatInputHeightPreference("topic-page")).toEqual({
			mode: "auto",
			height: 300,
		})
		expect(restoredStore.chatSiderDefaultWidth).toBe(260)
	})

	it("falls back when legacy panel dimensions are invalid", () => {
		const seedStore = new InterfaceStore()
		localStorage.setItem(
			seedStore.chatPanelSizeKey,
			JSON.stringify({
				chatInputDefaultHeight: "invalid-height",
				chatSiderDefaultWidth: -1,
			}),
		)

		const restoredStore = new InterfaceStore()
		expect(restoredStore.getChatInputHeightPreference("topic-page")).toEqual({
			mode: "auto",
			height: 240,
		})
		expect(restoredStore.chatSiderDefaultWidth).toBe(240)
	})
})
