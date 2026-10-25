import { describe, expect, it } from "vitest"
import {
	applyPPTTransitionEdit,
	createPPTTransition,
	getPPTTransition,
	parsePPTTransition,
	reconcilePPTTransitions,
	type PPTTransitionEdit,
} from "../pptTransitions"

const paths = ["a.html", "chapters/b.html"]
const fade = createPPTTransition("fade")
const push = { ...createPPTTransition("push"), duration_ms: 800 }
function edit(value: Partial<PPTTransitionEdit>): PPTTransitionEdit {
	return {
		scope: "slides",
		paths: [paths[0]],
		expectedPaths: paths,
		expectedTransitions: undefined,
		...value,
	}
}

describe("PPT transition configuration", () => {
	it("uses complete overrides, explicit none, and deck defaults", () => {
		expect(getPPTTransition(undefined, paths[0])).toEqual({ effect: "none" })
		expect(getPPTTransition({ default: fade }, paths[0])).toEqual(fade)
		expect(
			getPPTTransition(
				{ default: fade, slides: { [paths[0]]: { effect: "none" } } },
				paths[0],
			),
		).toEqual({ effect: "none" })
		expect(
			getPPTTransition(
				{ default: fade, slides: { [paths[0]]: { effect: "push" } } },
				paths[0],
			),
		).toEqual({ effect: "none" })
	})

	it.each([
		null,
		[],
		{ effect: "spin", duration_ms: 400 },
		{ effect: "fade", duration_ms: 99 },
		{ effect: "fade", duration_ms: 2001 },
		{ effect: "fade", duration_ms: 125 },
		{ effect: "fade", duration_ms: 450.5 },
		{ effect: "fade", duration_ms: "400" },
		{ effect: "fade", duration_ms: 400, easing: "javascript:alert(1)" },
		{ effect: "push", duration_ms: 400, direction: "diagonal" },
	])("rejects invalid parameters: %j", (raw) => {
		expect(parsePPTTransition(raw)).toBeNull()
		expect(getPPTTransition({ default: raw }, paths[0])).toEqual({ effect: "none" })
	})

	it("normalizes all six presets and removes irrelevant parameters", () => {
		for (const effect of ["none", "fade", "push", "cover", "wipe", "zoom"] as const) {
			expect(parsePPTTransition(createPPTTransition(effect))).toEqual(
				createPPTTransition(effect),
			)
		}
		expect(parsePPTTransition({ ...push, effect: "fade" })).toEqual({
			...fade,
			duration_ms: 800,
		})
		expect(parsePPTTransition({ ...push, effect: "none" })).toEqual({ effect: "none" })
	})

	it("distinguishes choosing none from inheriting the deck default", () => {
		const config = { default: fade, slides: { [paths[0]]: push }, future: { keep: true } }
		const none = applyPPTTransitionEdit(config, paths, edit({ transition: { effect: "none" } }))
		expect(getPPTTransition(none, paths[0])).toEqual({ effect: "none" })
		const inherited = applyPPTTransitionEdit(none, paths, edit({ inherit: true }))
		expect(inherited).toEqual({ default: fade, slides: {}, future: { keep: true } })
		expect(getPPTTransition(inherited, paths[0])).toEqual(fade)
		expect(config.slides[paths[0]]).toEqual(push)
	})

	it("replaces all overrides in one operation while preserving other metadata", () => {
		const result = applyPPTTransitionEdit(
			{ default: push, slides: { [paths[0]]: push }, future: true },
			paths,
			edit({ scope: "all", paths, transition: fade }),
		)
		expect(result).toEqual({ default: fade, slides: {}, future: true })
	})

	it("preserves mixed parameters and leaves none slides inherited", () => {
		const deckPaths = [...paths, "none.html", "inherited.html"]
		const config = {
			default: { effect: "none" },
			slides: {
				[paths[0]]: push,
				[paths[1]]: { ...fade, easing: "linear" },
				"none.html": { effect: "none" },
			},
		}
		const result = applyPPTTransitionEdit(
			config,
			deckPaths,
			edit({ paths: deckPaths, patch: { duration_ms: 300 } }),
		)
		expect(result).toEqual({
			default: { effect: "none" },
			slides: {
				[paths[0]]: { ...push, duration_ms: 300 },
				[paths[1]]: { ...fade, duration_ms: 300, easing: "linear" },
				"none.html": { effect: "none" },
			},
		})
		const directionOnly = applyPPTTransitionEdit(
			{ default: fade },
			paths,
			edit({ paths, patch: { direction: "up" } }),
		)
		expect(directionOnly).toEqual({ default: fade, slides: {} })
	})

	it("requires explicit replacement before overwriting an unsupported effect", () => {
		const unknown = { effect: "future-effect", future_parameter: 9 }
		const config = { slides: { [paths[0]]: unknown } }
		expect(() =>
			applyPPTTransitionEdit(config, paths, edit({ patch: { duration_ms: 300 } })),
		).toThrow(/Unsupported/)
		expect(config.slides[paths[0]]).toEqual(unknown)
		expect(
			getPPTTransition(
				applyPPTTransitionEdit(config, paths, edit({ transition: fade })),
				paths[0],
			),
		).toEqual(fade)
	})

	it.each([
		{},
		{ duration_ms: 250.5 },
		{ duration_ms: 125 },
		{ direction: "spin" },
		{ easing: "ease" },
		{ effect: "none" },
		{ css: "anything" },
	])("rejects invalid partial updates: %j", (patch) => {
		expect(() =>
			applyPPTTransitionEdit(
				{ default: fade },
				paths,
				edit({ patch: patch as PPTTransitionEdit["patch"] }),
			),
		).toThrow()
	})

	it("rejects missing, duplicate, unsafe targets and conflicting operations", () => {
		for (const target of [
			[],
			["missing.html"],
			[paths[0], paths[0]],
			["../a.html"],
			["/a.html"],
			["C:/a.html"],
			["__proto__"],
		]) {
			expect(() =>
				applyPPTTransitionEdit(
					undefined,
					target.includes("missing.html") ? paths : [...paths, ...target],
					edit({ paths: target, transition: fade }),
				),
			).toThrow()
		}
		expect(() =>
			applyPPTTransitionEdit(undefined, paths, edit({ transition: fade, inherit: true })),
		).toThrow()
		expect(() =>
			applyPPTTransitionEdit(undefined, paths, edit({ scope: "all", transition: fade })),
		).toThrow()
	})

	it("keeps overrides on reorder, migrates rename, duplicates explicit settings, and prunes deleted paths", () => {
		const config = { default: fade, slides: { [paths[0]]: push }, extra: "keep" }
		expect(reconcilePPTTransitions(config, [...paths].reverse())).toEqual(config)
		expect(
			reconcilePPTTransitions(config, paths, {
				renamePath: { from: paths[0], to: paths[0] },
			}),
		).toEqual(config)
		const renamed = reconcilePPTTransitions(config, ["renamed.html", paths[1]], {
			renamePath: { from: paths[0], to: "renamed.html" },
		})
		expect(renamed).toEqual({ ...config, slides: { "renamed.html": push } })
		const copied = reconcilePPTTransitions(config, [...paths, "copy.html"], {
			duplicatePath: { from: paths[0], to: "copy.html" },
		})
		expect(copied).toEqual({ ...config, slides: { [paths[0]]: push, "copy.html": push } })
		const inheritedCopy = reconcilePPTTransitions(config, [...paths, "copy.html"], {
			duplicatePath: { from: paths[1], to: "copy.html" },
		})
		expect(inheritedCopy).toEqual(config)
		expect(reconcilePPTTransitions(copied, [paths[1]])).toEqual({ ...config, slides: {} })
	})

	it("uses prototype-safe maps without altering future metadata during structural changes", () => {
		const overrides = JSON.parse(
			'{"__proto__":{"effect":"none"},"a.html":{"effect":"future","custom":1}}',
		)
		const result = reconcilePPTTransitions({ slides: overrides }, paths) as {
			slides: Record<string, unknown>
		}
		expect(Object.getPrototypeOf(result.slides)).toBeNull()
		expect(Object.hasOwn(result.slides, "__proto__")).toBe(false)
		expect(result.slides[paths[0]]).toEqual({ effect: "future", custom: 1 })
	})
})
