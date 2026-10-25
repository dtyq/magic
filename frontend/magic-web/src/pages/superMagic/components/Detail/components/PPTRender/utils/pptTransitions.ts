export type PPTTransitionEffect = "none" | "fade" | "push" | "cover" | "wipe" | "zoom"
export type PPTTransitionDirection = "left" | "right" | "up" | "down"
export type PPTTransitionEasing = "linear" | "ease-in-out"

/** Persisted values are data only; the player owns all animation code. */
export interface PPTTransition {
	effect: PPTTransitionEffect
	duration_ms?: number
	direction?: PPTTransitionDirection
	easing?: PPTTransitionEasing
}

export interface PPTTransitionEdit {
	scope: "slides" | "all"
	paths: string[]
	transition?: PPTTransition
	patch?: Partial<PPTTransition>
	inherit?: boolean
	expectedTransitions: unknown
	expectedPaths: string[]
}

export function isTransitionRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isDirectionalTransition(effect: PPTTransitionEffect): boolean {
	return effect === "push" || effect === "cover" || effect === "wipe"
}

export function createPPTTransition(effect: PPTTransitionEffect): PPTTransition {
	if (effect === "none") return { effect }
	return {
		effect,
		duration_ms: isDirectionalTransition(effect) ? 450 : 400,
		easing: "ease-in-out",
		...(isDirectionalTransition(effect) ? { direction: "left" as const } : {}),
	}
}

/** Invalid/unknown effects must not prevent a deck from opening. Writers reject null. */
export function parsePPTTransition(value: unknown): PPTTransition | null {
	if (!isTransitionRecord(value)) return null
	const { effect, duration_ms, easing = "ease-in-out", direction = "left" } = value
	if (effect === "none") return { effect }
	if (!(["fade", "push", "cover", "wipe", "zoom"] as unknown[]).includes(effect)) return null
	if (
		typeof duration_ms !== "number" ||
		!Number.isInteger(duration_ms) ||
		duration_ms < 100 ||
		duration_ms > 2000 ||
		duration_ms % 50 !== 0 ||
		(easing !== "linear" && easing !== "ease-in-out")
	)
		return null
	const directional = isDirectionalTransition(effect as PPTTransitionEffect)
	if (directional && !(["left", "right", "up", "down"] as unknown[]).includes(direction))
		return null
	return {
		effect: effect as PPTTransitionEffect,
		duration_ms,
		easing,
		...(directional ? { direction: direction as PPTTransitionDirection } : {}),
	}
}

export function getPPTTransition(config: unknown, path: string): PPTTransition {
	if (!isTransitionRecord(config)) return { effect: "none" }
	const overrides = config.slides
	const raw =
		isTransitionRecord(overrides) && Object.hasOwn(overrides, path)
			? overrides[path]
			: config.default
	return parsePPTTransition(raw) ?? { effect: "none" }
}

/** Only the small transition payload is compared, never the attachment tree. */
export function getPPTTransitionsSignature(value: unknown): string {
	return JSON.stringify(value ?? null)
}

/** Structural writes preserve unknown metadata and only reconcile path ownership. */
export function reconcilePPTTransitions(
	value: unknown,
	paths: readonly string[],
	options?: {
		renamePath?: { from: string; to: string }
		duplicatePath?: { from: string; to: string }
	},
): unknown {
	if (!isTransitionRecord(value) || !isTransitionRecord(value.slides)) return value
	const overrides: Record<string, unknown> = Object.create(null)
	for (const [path, setting] of Object.entries(value.slides)) overrides[path] = setting
	if (
		options?.renamePath &&
		options.renamePath.from !== options.renamePath.to &&
		Object.hasOwn(overrides, options.renamePath.from)
	) {
		overrides[options.renamePath.to] = overrides[options.renamePath.from]
		delete overrides[options.renamePath.from]
	}
	if (options?.duplicatePath && Object.hasOwn(overrides, options.duplicatePath.from)) {
		overrides[options.duplicatePath.to] = overrides[options.duplicatePath.from]
	}
	const validPaths = new Set(paths)
	for (const path of Object.keys(overrides)) if (!validPaths.has(path)) delete overrides[path]
	return { ...value, slides: overrides }
}

export function applyPPTTransitionEdit(
	config: unknown,
	paths: readonly string[],
	edit: PPTTransitionEdit,
): unknown {
	const current = isTransitionRecord(config) ? config : {}
	const validPaths = new Set(paths)
	if (
		!edit.paths.length ||
		new Set(edit.paths).size !== edit.paths.length ||
		edit.paths.some((path) => !validPaths.has(path) || !isSafeTransitionPath(path))
	) {
		throw new Error("Transition target no longer exists")
	}
	if (edit.scope === "all") {
		const transition = parsePPTTransition(edit.transition)
		if (!transition || edit.inherit || edit.patch || edit.paths.length !== validPaths.size)
			throw new Error("Invalid deck transition")
		return { ...current, default: transition, slides: {} }
	}
	const operations =
		Number(edit.inherit === true) +
		Number(edit.transition !== undefined) +
		Number(edit.patch !== undefined)
	if (edit.scope !== "slides" || operations !== 1)
		throw new Error("Invalid slide transition operation")
	if (edit.patch !== undefined) validateTransitionPatch(edit.patch)
	if (edit.transition !== undefined && !parsePPTTransition(edit.transition)) {
		throw new Error("Invalid slide transition")
	}
	const overrides: Record<string, unknown> = Object.assign(
		Object.create(null),
		isTransitionRecord(current.slides) ? current.slides : {},
	)
	for (const path of edit.paths) {
		if (edit.inherit) {
			delete overrides[path]
			continue
		}
		let raw: unknown = edit.transition
		if (edit.patch) {
			const source = Object.hasOwn(overrides, path) ? overrides[path] : current.default
			const existing =
				source === undefined ? { effect: "none" as const } : parsePPTTransition(source)
			// A fallback is safe for playback, but must not silently rewrite unsupported metadata.
			if (!existing) throw new Error("Unsupported transition cannot be partially edited")
			if (existing.effect === "none") continue
			const applicablePatch = { ...edit.patch }
			if (!isDirectionalTransition(existing.effect)) delete applicablePatch.direction
			if (!Object.keys(applicablePatch).length) continue
			raw = { ...existing, ...applicablePatch }
		}
		const transition = parsePPTTransition(raw)
		if (!transition) throw new Error("Invalid slide transition")
		overrides[path] = transition
	}
	return reconcilePPTTransitions({ ...current, slides: overrides }, paths)
}

function isSafeTransitionPath(path: string): boolean {
	return (
		!/[\\:]/.test(path) &&
		!path.includes("\0") &&
		!["__proto__", "prototype", "constructor"].includes(path) &&
		path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
	)
}

function validateTransitionPatch(patch: Partial<PPTTransition>): void {
	if (
		!isTransitionRecord(patch) ||
		!Object.keys(patch).length ||
		Object.keys(patch).some((key) => !["duration_ms", "direction", "easing"].includes(key)) ||
		(Object.hasOwn(patch, "duration_ms") &&
			(typeof patch.duration_ms !== "number" ||
				!Number.isInteger(patch.duration_ms) ||
				patch.duration_ms < 100 ||
				patch.duration_ms > 2000 ||
				patch.duration_ms % 50 !== 0)) ||
		(Object.hasOwn(patch, "direction") &&
			!["left", "right", "up", "down"].includes(patch.direction as string)) ||
		(Object.hasOwn(patch, "easing") &&
			!["linear", "ease-in-out"].includes(patch.easing as string))
	) {
		throw new Error("Invalid transition parameters")
	}
}
