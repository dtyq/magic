import { arrayMove } from "@dnd-kit/sortable"

export const DISPLAYED_CONTAINER_ID = "displayed"
export const HIDDEN_CONTAINER_ID = "hidden"

export interface SortableCrewIcon {
	type?: string
	color?: string
	url?: string
}

export interface SortableCrewAgent {
	id: string
	agentCode?: string | null
	code?: string | null
	name: string
	description?: string | null
	icon?: SortableCrewIcon | null
	icon_type?: number | null
}

export interface SortingDraft {
	displayed: SortableCrewAgent[]
	hidden: SortableCrewAgent[]
}

export function createSortingDraft(data?: {
	frequent?: SortableCrewAgent[]
	all?: SortableCrewAgent[]
}): SortingDraft {
	const displayed = createUniqueSortableAgents(data?.frequent ?? [])
	const displayedIds = new Set(displayed.map(resolveSortableAgentOrderValue))
	const hidden = createUniqueSortableAgents(data?.all ?? []).filter(
		(agent) => !displayedIds.has(resolveSortableAgentOrderValue(agent)),
	)

	return {
		displayed,
		hidden,
	}
}

export function resolveSortableAgentOrderValue(agent: SortableCrewAgent): string {
	return agent.agentCode?.trim() || agent.code?.trim() || agent.id
}

export function serializeSortingDraft(draft: SortingDraft) {
	return {
		frequent: draft.displayed.map(resolveSortableAgentOrderValue),
		all: [...draft.displayed, ...draft.hidden].map(resolveSortableAgentOrderValue),
	}
}

export function hasSortingDraftChanged(currentDraft: SortingDraft, initialDraft: SortingDraft) {
	const currentPayload = serializeSortingDraft(currentDraft)
	const initialPayload = serializeSortingDraft(initialDraft)

	if (currentPayload.frequent.length !== initialPayload.frequent.length) return true
	if (currentPayload.all.length !== initialPayload.all.length) return true

	return (
		currentPayload.frequent.some((value, index) => value !== initialPayload.frequent[index]) ||
		currentPayload.all.some((value, index) => value !== initialPayload.all[index])
	)
}

export function resolveSortingContainerId(
	draft: SortingDraft,
	id: string | null | undefined,
): string | null {
	if (!id) return null
	if (id === DISPLAYED_CONTAINER_ID || id === HIDDEN_CONTAINER_ID) return id
	if (draft.displayed.some((item) => item.id === id)) return DISPLAYED_CONTAINER_ID
	if (draft.hidden.some((item) => item.id === id)) return HIDDEN_CONTAINER_ID
	return null
}

export function moveSortableCrewAgent({
	draft,
	activeId,
	overId,
	overContainerId,
}: {
	draft: SortingDraft
	activeId: string
	overId: string
	overContainerId: string
}): SortingDraft {
	const activeContainerId = resolveSortingContainerId(draft, activeId)
	if (!activeContainerId) return draft

	if (activeContainerId === overContainerId)
		return reorderSortableCrewAgent({
			draft,
			containerId: activeContainerId,
			activeId,
			overId,
		})

	return moveSortableCrewAgentAcrossContainers({
		draft,
		activeId,
		overId,
		activeContainerId,
		overContainerId,
	})
}

export function moveSortableCrewAgentToIndex({
	draft,
	activeId,
	targetContainerId,
	targetIndex,
}: {
	draft: SortingDraft
	activeId: string
	targetContainerId: string
	targetIndex: number
}): SortingDraft {
	const activeContainerId = resolveSortingContainerId(draft, activeId)
	if (!activeContainerId) return draft

	const sourceItems =
		activeContainerId === DISPLAYED_CONTAINER_ID ? draft.displayed : draft.hidden
	const targetItems =
		targetContainerId === DISPLAYED_CONTAINER_ID ? draft.displayed : draft.hidden
	const activeIndex = sourceItems.findIndex((item) => item.id === activeId)
	if (activeIndex < 0) return draft

	const nextSourceItems = [...sourceItems]
	const [activeItem] = nextSourceItems.splice(activeIndex, 1)
	if (!activeItem) return draft

	const nextTargetItems =
		activeContainerId === targetContainerId ? nextSourceItems : [...targetItems]
	const normalizedTargetIndex = normalizeTargetIndex({
		targetIndex,
		targetItemsLength: nextTargetItems.length,
	})

	nextTargetItems.splice(normalizedTargetIndex, 0, activeItem)

	if (activeContainerId === targetContainerId) {
		if (targetContainerId === DISPLAYED_CONTAINER_ID)
			return {
				...draft,
				displayed: nextTargetItems,
			}

		return {
			...draft,
			hidden: nextTargetItems,
		}
	}

	if (activeContainerId === DISPLAYED_CONTAINER_ID)
		return {
			displayed: nextSourceItems,
			hidden: nextTargetItems,
		}

	return {
		displayed: nextTargetItems,
		hidden: nextSourceItems,
	}
}

function reorderSortableCrewAgent({
	draft,
	containerId,
	activeId,
	overId,
}: {
	draft: SortingDraft
	containerId: string
	activeId: string
	overId: string
}): SortingDraft {
	const items = containerId === DISPLAYED_CONTAINER_ID ? draft.displayed : draft.hidden
	const activeIndex = items.findIndex((item) => item.id === activeId)
	const overIndex =
		overId === containerId ? items.length - 1 : items.findIndex((item) => item.id === overId)
	if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return draft

	const reorderedItems = arrayMove(items, activeIndex, overIndex)
	if (containerId === DISPLAYED_CONTAINER_ID)
		return {
			...draft,
			displayed: reorderedItems,
		}

	return {
		...draft,
		hidden: reorderedItems,
	}
}

function moveSortableCrewAgentAcrossContainers({
	draft,
	activeId,
	overId,
	activeContainerId,
	overContainerId,
}: {
	draft: SortingDraft
	activeId: string
	overId: string
	activeContainerId: string
	overContainerId: string
}): SortingDraft {
	const activeItems =
		activeContainerId === DISPLAYED_CONTAINER_ID ? draft.displayed : draft.hidden
	const overItems = overContainerId === DISPLAYED_CONTAINER_ID ? draft.displayed : draft.hidden
	const activeIndex = activeItems.findIndex((item) => item.id === activeId)
	if (activeIndex < 0) return draft

	const nextActiveItems = [...activeItems]
	const [activeItem] = nextActiveItems.splice(activeIndex, 1)
	if (!activeItem) return draft

	const overIndex =
		overId === overContainerId
			? overItems.length
			: overItems.findIndex((item) => item.id === overId)
	const nextOverItems = [...overItems]
	const insertionIndex = overIndex < 0 ? nextOverItems.length : overIndex
	nextOverItems.splice(insertionIndex, 0, activeItem)

	if (activeContainerId === DISPLAYED_CONTAINER_ID)
		return {
			displayed: nextActiveItems,
			hidden: nextOverItems,
		}

	return {
		displayed: nextOverItems,
		hidden: nextActiveItems,
	}
}

function createUniqueSortableAgents(items: SortableCrewAgent[]) {
	const uniqueAgents: SortableCrewAgent[] = []
	const seenIds = new Set<string>()

	for (const agent of items) {
		const orderValue = resolveSortableAgentOrderValue(agent)
		if (seenIds.has(orderValue)) continue

		seenIds.add(orderValue)
		uniqueAgents.push(agent)
	}

	return uniqueAgents
}

function normalizeTargetIndex({
	targetIndex,
	targetItemsLength,
}: {
	targetIndex: number
	targetItemsLength: number
}) {
	if (targetIndex <= 0) return 0
	if (targetIndex >= targetItemsLength) return targetItemsLength
	return targetIndex
}
