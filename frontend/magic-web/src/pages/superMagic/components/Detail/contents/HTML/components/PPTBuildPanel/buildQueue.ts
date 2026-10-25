import type { PPTBuildEntry, PPTBuildUpdate } from "../../iframe-bridge/types/props"

/** Queue groups correspond to clicks, not individual elements. */
export function groupBuildQueue(entries: PPTBuildEntry[]) {
	const groups = new Map<number, PPTBuildEntry[]>()
	for (const entry of entries) {
		const group = groups.get(entry.build.step) ?? []
		group.push(entry)
		groups.set(entry.build.step, group)
	}
	return [...groups].sort(([a], [b]) => a - b).map(([step, items]) => ({ step, items }))
}

/** Renumber all groups together so one undo restores the complete previous order. */
export function reorderBuildQueue(
	entries: PPTBuildEntry[],
	from: number,
	to: number,
): PPTBuildUpdate[] {
	const groups = groupBuildQueue(entries)
	if (from === to || from < 0 || to < 0 || from >= groups.length || to >= groups.length) return []
	const [moved] = groups.splice(from, 1)
	groups.splice(to, 0, moved)
	return groups.flatMap((group, index) =>
		group.items.map((entry) => ({
			selector: entry.selector,
			build: { ...entry.build, step: index + 1 },
		})),
	)
}

export function appendBuildStep(
	entries: PPTBuildEntry[],
	selector: string,
	effect: "appear" | "fade" = "fade",
): PPTBuildUpdate[] {
	const groups = groupBuildQueue(entries)
	if (groups.length >= 1000) return []
	const last = groups.at(-1)?.step ?? 0
	// Authored gaps may already reach 1000; normalize as part of the same undoable edit.
	const normalized =
		last >= 1000
			? groups.flatMap((group, index) =>
					group.items
						.filter((entry) => entry.selector !== selector)
						.map((entry) => ({
							selector: entry.selector,
							build: { ...entry.build, step: index + 1 },
						})),
				)
			: []
	return [
		...normalized,
		{
			selector,
			build: { step: last >= 1000 ? groups.length + 1 : last + 1, effect },
		},
	]
}

export const NEW_STEP_DROP_ID = "new-step"

/**
 * Updates for dropping one element onto a step (its numeric step) or the new-step zone.
 * Dropping where it already is changes nothing, and a lone element already is its own step.
 */
export function resolveItemDrop(
	entries: PPTBuildEntry[],
	selector: string,
	overId: string | number,
): PPTBuildUpdate[] {
	const entry = entries.find((item) => item.selector === selector)
	if (!entry) return []
	if (overId === NEW_STEP_DROP_ID) {
		const own = groupBuildQueue(entries).find((group) => group.step === entry.build.step)
		if (own && own.items.length === 1) return []
		return appendBuildStep(entries, selector, entry.build.effect)
	}
	if (typeof overId !== "number" || overId === entry.build.step) return []
	return [{ selector, build: { ...entry.build, step: overId } }]
}

export const AUTO_DELAY_OPTIONS_MS = [0, 500, 1000, 2000, 3000]

/** A step plays by itself when any of its elements carries a delay; the longest wins. */
export function groupAutoDelay(items: PPTBuildEntry[]): number | null {
	const delays = items.flatMap((item) =>
		item.build.after === undefined ? [] : [item.build.after],
	)
	return delays.length ? Math.max(...delays) : null
}

/** Applies one trigger to every element of a step, so the group never disagrees with itself. */
export function setGroupAutoDelay(items: PPTBuildEntry[], delay: number | null): PPTBuildUpdate[] {
	return items.map((item) => {
		const { after: _previous, ...rest } = item.build
		return { selector: item.selector, build: delay === null ? rest : { ...rest, after: delay } }
	})
}

/**
 * Adds several elements at once as one new step: the first creates the step and the rest join it.
 * Returns the combined updates so the whole addition is one undoable command.
 */
export function appendBuildStepGroup(
	entries: PPTBuildEntry[],
	selectors: string[],
	effect: "appear" | "fade" = "fade",
): PPTBuildUpdate[] {
	const [first, ...rest] = selectors
	if (first === undefined) return []
	const updates = appendBuildStep(entries, first, effect)
	const created = updates.find((update) => update.selector === first)?.build
	if (!created) return []
	return [
		...updates,
		...rest.map((selector) => ({ selector, build: { step: created.step, effect } })),
	]
}
