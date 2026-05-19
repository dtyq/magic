import { describe, expect, it } from "vitest"
import {
	createSortingDraft,
	DISPLAYED_CONTAINER_ID,
	hasSortingDraftChanged,
	moveSortableCrewAgent,
	moveSortableCrewAgentToIndex,
	serializeSortingDraft,
} from "../my-crew-manage-sorting-dialog.shared"

function createAgent(id: string, overrides: Record<string, unknown> = {}) {
	return {
		id,
		code: id,
		name: `Agent ${id}`,
		...overrides,
	}
}

describe("my-crew-manage-sorting-dialog.shared", () => {
	it("deduplicates displayed items from hidden list", () => {
		const draft = createSortingDraft({
			frequent: [createAgent("crew-a"), createAgent("crew-b")],
			all: [createAgent("crew-b"), createAgent("crew-c"), createAgent("crew-c")],
		})

		expect(draft.displayed.map((item) => item.id)).toEqual(["crew-a", "crew-b"])
		expect(draft.hidden.map((item) => item.id)).toEqual(["crew-c"])
	})

	it("serializes displayed items before hidden ones", () => {
		const payload = serializeSortingDraft({
			displayed: [createAgent("row-1", { code: "crew-a" })],
			hidden: [createAgent("row-2", { code: null, agentCode: "crew-b" })],
		})

		expect(payload).toEqual({
			frequent: ["crew-a"],
			all: ["crew-a", "crew-b"],
		})
	})

	it("detects ordering changes", () => {
		const initialDraft = createSortingDraft({
			frequent: [createAgent("crew-a"), createAgent("crew-b")],
			all: [createAgent("crew-c")],
		})
		const changedDraft = createSortingDraft({
			frequent: [createAgent("crew-b"), createAgent("crew-a")],
			all: [createAgent("crew-c")],
		})

		expect(hasSortingDraftChanged(changedDraft, initialDraft)).toBe(true)
		expect(hasSortingDraftChanged(initialDraft, initialDraft)).toBe(false)
	})

	it("moves an item across containers", () => {
		const draft = createSortingDraft({
			frequent: [createAgent("crew-a")],
			all: [createAgent("crew-b"), createAgent("crew-c")],
		})

		const nextDraft = moveSortableCrewAgent({
			draft,
			activeId: "crew-b",
			overId: DISPLAYED_CONTAINER_ID,
			overContainerId: DISPLAYED_CONTAINER_ID,
		})

		expect(nextDraft.displayed.map((item) => item.id)).toEqual(["crew-a", "crew-b"])
		expect(nextDraft.hidden.map((item) => item.id)).toEqual(["crew-c"])
	})

	it("reorders inside the same container", () => {
		const draft = createSortingDraft({
			frequent: [createAgent("crew-a"), createAgent("crew-b"), createAgent("crew-c")],
			all: [createAgent("crew-d")],
		})

		const nextDraft = moveSortableCrewAgent({
			draft,
			activeId: "crew-c",
			overId: "crew-a",
			overContainerId: DISPLAYED_CONTAINER_ID,
		})

		expect(nextDraft.displayed.map((item) => item.id)).toEqual(["crew-c", "crew-a", "crew-b"])
		expect(resolveHiddenIds(nextDraft)).toEqual(["crew-d"])
	})

	it("moves an item to a specific index across containers", () => {
		const draft = createSortingDraft({
			frequent: [createAgent("crew-a"), createAgent("crew-b")],
			all: [createAgent("crew-c"), createAgent("crew-d"), createAgent("crew-e")],
		})

		const nextDraft = moveSortableCrewAgentToIndex({
			draft,
			activeId: "crew-d",
			targetContainerId: DISPLAYED_CONTAINER_ID,
			targetIndex: 1,
		})

		expect(nextDraft.displayed.map((item) => item.id)).toEqual(["crew-a", "crew-d", "crew-b"])
		expect(nextDraft.hidden.map((item) => item.id)).toEqual(["crew-c", "crew-e"])
	})
})

function resolveHiddenIds(draft: { hidden: Array<{ id: string }> }) {
	return draft.hidden.map((item) => item.id)
}
