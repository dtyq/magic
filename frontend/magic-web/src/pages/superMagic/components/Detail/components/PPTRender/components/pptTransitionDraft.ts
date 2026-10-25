import { getPPTTransition, parsePPTTransition, type PPTTransition } from "../utils/pptTransitions"

export type TransitionScope = "current" | "selected" | "all"
export interface TransitionSlide {
	path: string
	label: string
}

export function transitionRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
}

export function getRawTransition(config: unknown, path?: string): unknown {
	const record = transitionRecord(config)
	const overrides = transitionRecord(record.slides)
	return path && Object.hasOwn(overrides, path) ? overrides[path] : record.default
}

export function getDraftTransitions(
	config: unknown,
	paths: string[],
	scope: TransitionScope,
	replacement?: PPTTransition,
	patch: Partial<PPTTransition> = {},
	inherit = false,
): PPTTransition[] {
	const fallback: PPTTransition = parsePPTTransition(getRawTransition(config)) ?? {
		effect: "none",
	}
	const originals =
		scope === "all" ? [fallback] : paths.map((path) => getPPTTransition(config, path))
	return originals.map((original) => {
		if (inherit) return fallback
		if (replacement) return replacement
		// Parameter-only batch edits leave unrelated parameters and none slides intact.
		if (original.effect === "none") return original
		const result = { ...original, ...patch }
		if (!["push", "cover", "wipe"].includes(result.effect)) delete result.direction
		return result
	})
}

export function commonTransitionField<K extends keyof PPTTransition>(
	values: PPTTransition[],
	field: K,
): PPTTransition[K] | undefined {
	const first = values[0]?.[field]
	return values.every((value) => value[field] === first) ? first : undefined
}
