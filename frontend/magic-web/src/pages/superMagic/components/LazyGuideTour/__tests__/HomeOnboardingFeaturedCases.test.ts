import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import enGuideTour from "@/assets/locales/en_US/super/guideTour.json"
import zhGuideTour from "@/assets/locales/zh_CN/super/guideTour.json"

/**
 * The three examples the first-AI-work tour offers, as a contract rather than as copy.
 *
 * The picker is the only surface these strings have, and it hands them straight to `t`, so a slot
 * that moved or lost its words does not fail in the app the way a missing import does: the card
 * would simply say `homeOnboarding.featured.case2.prompt`, and the user's first task would be
 * prefilled with that. Nothing else in the suite would notice — the tour's own specs drive the flow
 * with a `t` that echoes its key back, which is what keeps them about the flow.
 *
 * So what is pinned is the shape and the agreement, not the wording: three cases, each with both
 * halves in both locales, three *different* titles (a case added by copy-paste is how a picker ends
 * up offering the same example twice), and the component asking for the keys this file reads.
 * Reword any of them freely; what fails here is losing one, or moving it to a key the other side
 * does not use.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url))

/** The slots the picker offers, in the order it offers them. */
const CASE_SLOTS = ["case1", "case2", "case3"] as const

/** The two locales the app ships with, by the file the tour's namespace resolves to. */
const LOCALES = [
	{ name: "zh_CN", copy: zhGuideTour },
	{ name: "en_US", copy: enGuideTour },
]

describe("the featured cases the first-AI-work picker offers", () => {
	it("carries a title and a prompt for every case, in every locale", () => {
		const problems: string[] = []

		for (const { name, copy } of LOCALES) {
			for (const slot of CASE_SLOTS) {
				const words = copy.homeOnboarding.featured[slot]

				if (words.title.trim() === "") problems.push(`${name} has no title for ${slot}`)
				if (words.prompt.trim() === "") problems.push(`${name} has no prompt for ${slot}`)
			}
		}

		expect(problems).toEqual([])
	})

	it("offers three different examples rather than one repeated", () => {
		/*
		 * The titles are what the user chooses between, so two of them being equal is a picker
		 * offering the same example twice — which is what a case copied from its neighbour and left
		 * with its title looks like. The prompts get the same treatment for the same reason: a case
		 * whose prompt was not replaced sends the previous example's request.
		 */
		for (const { name, copy } of LOCALES) {
			const titles = CASE_SLOTS.map((slot) => copy.homeOnboarding.featured[slot].title)
			const prompts = CASE_SLOTS.map((slot) => copy.homeOnboarding.featured[slot].prompt)

			expect(new Set(titles).size, `${name} repeats a case title`).toBe(CASE_SLOTS.length)
			expect(new Set(prompts).size, `${name} repeats a case prompt`).toBe(CASE_SLOTS.length)
		}
	})

	it("reads the keys this contract checks", () => {
		/*
		 * The two halves have to agree on *where* the words are, not only that words exist: the
		 * picker builds its list from `homeOnboarding.featured.<slot>.<half>`, so a slot renamed on
		 * one side and not the other is a key the user sees printed on the card.
		 */
		const source = fs.readFileSync(path.resolve(dirname, "../HomeOnboardingTour.tsx"), "utf8")

		for (const slot of CASE_SLOTS) {
			for (const half of ["title", "prompt"]) {
				expect(source).toContain(`homeOnboarding.featured.${slot}.${half}`)
			}
		}
	})
})
