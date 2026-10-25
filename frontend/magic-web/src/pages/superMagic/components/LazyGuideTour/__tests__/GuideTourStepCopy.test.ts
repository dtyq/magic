import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import enGuideTour from "@/assets/locales/en_US/super/guideTour.json"
import zhGuideTour from "@/assets/locales/zh_CN/super/guideTour.json"

/**
 * The copy of the guided run as a contract rather than as words.
 *
 * The tour's own specs drive the flow with a `t` that echoes its key back — which is what keeps them
 * about the flow — so none of them can see a locale file at all. A slot that was renamed, or one
 * half of a pair that was removed from one locale and left in the other, therefore ships silently:
 * the app would print `homeOnboarding.steps.composer.description` in the popover, and only the user
 * would find out.
 *
 * Three things are pinned here, all of them structural rather than editorial.
 *
 * The composer step has exactly the two halves it is meant to have, and the Chinese one is the
 * wording asked for — the step is the first thing a new account reads, so its two halves are worth
 * holding still. Reword the English side freely.
 *
 * The experts step is held the same way, and for a second reason: it was renamed from an "expert
 * area" to digital employees, which is a rename of the noun and not a reword. That one has to land
 * on both sides together, because the row of chips the step points at is the only thing on screen
 * that would disagree with it.
 *
 * The three goal rows of the introduction and the "prompt ready" badge are gone from *both* sides at
 * once — from the locale files and from the component that asks for them. A removal that lands in
 * one of the two is exactly the drift this file exists to catch: keys left in the copy are dead
 * weight, and a component still asking for a removed key prints the key.
 */
const dirname = path.dirname(fileURLToPath(import.meta.url))

/** The two locales the app ships with, by the file the tour's namespace resolves to. */
const LOCALES = [
	{ name: "zh_CN", copy: zhGuideTour },
	{ name: "en_US", copy: enGuideTour },
]

/** The three promises of the introduction, in the order the task walks them. */
const GOAL_SLOTS = ["task", "send", "result"] as const

/** The component that owns the copy above, read as text so the two halves can be compared. */
function tourSource() {
	return fs.readFileSync(path.resolve(dirname, "../HomeOnboardingTour.tsx"), "utf8")
}

describe("the copy of the home onboarding run", () => {
	it("gives the composer step its two halves, in both locales", () => {
		const problems: string[] = []

		for (const { name, copy } of LOCALES) {
			const step = copy.homeOnboarding.steps.composer

			if (step.title.trim() === "")
				problems.push(`${name} has no title for the composer step`)
			if (step.description.trim() === "") {
				problems.push(`${name} has no description for the composer step`)
			}
		}

		expect(problems).toEqual([])
	})

	it("carries the composer step's wording, and names the tools it talks about", () => {
		/*
		 * The Chinese side is quoted rather than described, because it is a wording that was asked
		 * for: the step now names the four ways into the composer — files, plugins, model, voice —
		 * where it used to hand the user on to a later step. Losing them is a loss of content, not a
		 * rewording, and no other test reads this file.
		 */
		expect(zhGuideTour.homeOnboarding.steps.composer).toEqual({
			description: "在这里描述需要完成的工作，可上传文件、选择插件、选择模型、语音输入等。",
			title: "需求输入和工具使用",
		})

		// The English side is free to be worded its own way, but not to be the Chinese one.
		expect(enGuideTour.homeOnboarding.steps.composer.title).not.toBe(
			zhGuideTour.homeOnboarding.steps.composer.title,
		)
		expect(enGuideTour.homeOnboarding.steps.composer.description).not.toBe(
			zhGuideTour.homeOnboarding.steps.composer.description,
		)
	})

	it("keeps the component asking for the composer step's keys, in the right places", () => {
		const source = tourSource()

		expect(source).toContain("homeOnboarding.steps.composer.title")
		expect(source).toContain("homeOnboarding.steps.composer.description")
	})

	it("has dropped the introduction's subtitles and the send badge from copy and component alike", () => {
		const source = tourSource()
		const problems: string[] = []

		for (const { name, copy } of LOCALES) {
			const goals = copy.homeOnboarding.welcome.goals as Record<
				string,
				Record<string, string>
			>
			const send = copy.homeOnboarding.featured.send as Record<string, string>

			for (const slot of GOAL_SLOTS) {
				if (goals[slot].description !== undefined) {
					problems.push(`${name} still carries welcome.goals.${slot}.description`)
				}
				// The row is a title and nothing else: a second key under it is a second line on screen.
				if (Object.keys(goals[slot]).join(",") !== "title") {
					problems.push(`${name} has more than a title under welcome.goals.${slot}`)
				}
				if (source.includes(`homeOnboarding.welcome.goals.${slot}.description`)) {
					problems.push(`the component still asks for welcome.goals.${slot}.description`)
				}
			}

			if (send.badge !== undefined) problems.push(`${name} still carries featured.send.badge`)
		}

		if (source.includes("homeOnboarding.featured.send.badge")) {
			problems.push("the component still asks for featured.send.badge")
		}

		expect(problems).toEqual([])
	})
})

describe("the copy of the experts step", () => {
	it("carries the wording that was asked for on the Chinese side", () => {
		expect(zhGuideTour.homeOnboarding.steps.experts).toEqual({
			description:
				"不同数字员工擅长处理不同任务，不确定怎么选时，直接使用默认的超级麦吉即可。",
			title: "AI 数字员工",
		})
	})

	it("gives both locales the two halves, and neither of them the old noun", () => {
		/*
		 * Checked as a pair rather than per locale: a rename that lands in one file and not the
		 * other is the failure this catches, and it reads as a wrong noun only in the language it
		 * was missed in.
		 */
		const problems: string[] = []

		for (const { name, copy } of LOCALES) {
			const step = copy.homeOnboarding.steps.experts

			if (step.title.trim() === "") problems.push(`${name} has no title for the experts step`)
			if (step.description.trim() === "") {
				problems.push(`${name} has no description for the experts step`)
			}
			if (`${step.title}${step.description}`.match(/专家|expert/i)) {
				problems.push(`${name} still calls the step an expert area: ${step.title}`)
			}
			if (!`${step.title}${step.description}`.match(/数字员工|digital employee/i)) {
				problems.push(`${name} does not name the step as digital employees: ${step.title}`)
			}
		}

		expect(problems).toEqual([])

		// The English side is worded its own way, but it is not the Chinese one.
		expect(enGuideTour.homeOnboarding.steps.experts.title).not.toBe(
			zhGuideTour.homeOnboarding.steps.experts.title,
		)
		expect(enGuideTour.homeOnboarding.steps.experts.description).not.toBe(
			zhGuideTour.homeOnboarding.steps.experts.description,
		)
	})

	it("keeps the component asking for the experts step's keys, in the right places", () => {
		const source = tourSource()

		expect(source).toContain("homeOnboarding.steps.experts.title")
		expect(source).toContain("homeOnboarding.steps.experts.description")
	})
})
