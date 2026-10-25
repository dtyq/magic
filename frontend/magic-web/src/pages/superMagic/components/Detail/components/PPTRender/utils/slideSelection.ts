/** Selection uses file identities; page numbers are only a projection of current order. */
export function selectSlideRange(ids: readonly string[], anchor: string, target: string): string[] {
	const start = ids.indexOf(anchor)
	const end = ids.indexOf(target)
	if (start < 0 || end < 0) return end < 0 ? [] : [target]
	return ids.slice(Math.min(start, end), Math.max(start, end) + 1).filter(Boolean)
}

/** A drop gap belongs to the original list, before selected items are removed. */
export function moveSelectedToGap<T>(
	items: readonly T[],
	selected: ReadonlySet<string>,
	getId: (item: T) => string,
	gap: number,
): T[] {
	const boundedGap = Math.max(0, Math.min(items.length, gap))
	const moving = items.filter((item) => selected.has(getId(item)))
	const remaining = items.filter((item) => !selected.has(getId(item)))
	const insertion = items.slice(0, boundedGap).filter((item) => !selected.has(getId(item))).length
	return [...remaining.slice(0, insertion), ...moving, ...remaining.slice(insertion)]
}
