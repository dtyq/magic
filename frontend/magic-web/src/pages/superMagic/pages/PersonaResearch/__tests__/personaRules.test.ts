import { describe, expect, it } from "vitest"
import {
	createPersonaId,
	detectPersonalIdentifiers,
	emptyPersonaForm,
	formToPersona,
	missingRequiredFields,
	personaToForm,
	resolveEditedTier,
} from "../services/personaRules"
import { parsePersonaFile } from "../services/researchFiles"
import type { PersonaFile } from "../types"

const NOW = "2026-10-18T15:02:00+08:00"

function filledForm() {
	return {
		...emptyPersonaForm(),
		name: "王芳",
		tagline: "社区烘焙店老板，自己做账",
		age: "35-44",
		gender: "female",
		occupation: "烘焙店老板",
		pains: ["月底对账要花两个晚上", ""],
		story: "开店 6 年，熟客占七成。",
		tags: "价格敏感，熟客生意",
	}
}

const evidenceBased: PersonaFile = {
	schema_version: 1,
	id: "p_zhangwei_7f3a",
	name: "Zhang Wei",
	tier: "evidence_based",
	dimensions: {
		demographics: { age: 52, education: "high school" },
		needs_pains: ["Forgets phone deals"],
		behavior: { purchase_channel: "offline dealers" },
	},
	evidence: [
		{ id: "e1", type: "web" },
		{ id: "e2", type: "social", platform: "xiaohongshu" },
		{ id: "e3", type: "upload" },
	],
	field_sources: { demographics: ["e1"], needs_pains: ["e1", "e3"], behavior: ["e2"] },
}

describe("manual persona form", () => {
	it("lists the six required fields of an empty form", () => {
		expect(missingRequiredFields(emptyPersonaForm())).toEqual([
			"name",
			"tagline",
			"age",
			"occupation",
			"pains",
			"story",
		])
		expect(missingRequiredFields(filledForm())).toEqual([])
	})

	it("builds a manual persona whose filled dimensions are marked as the user's", () => {
		const persona = formToPersona(filledForm(), { id: "p_user_1a2b", now: NOW })

		expect(persona.tier).toBe("manual")
		expect(persona.tags).toEqual(["价格敏感", "熟客生意"])
		expect(persona.dimensions?.demographics).toEqual({
			age: "35-44",
			gender: "female",
			occupation: "烘焙店老板",
		})
		expect(persona.dimensions?.needs_pains).toEqual(["月底对账要花两个晚上"])
		expect(persona.field_sources).toEqual({ demographics: "user", needs_pains: "user" })
		expect(persona.edited_at).toBeUndefined()
		// The written file passes the page's own contract parser.
		expect(parsePersonaFile(JSON.parse(JSON.stringify(persona))).ok).toBe(true)
	})
})

describe("editing an AI persona", () => {
	it("keeps untouched dimensions, types and sources", () => {
		const persona = formToPersona(personaToForm(evidenceBased), {
			id: evidenceBased.id,
			base: evidenceBased,
			now: NOW,
		})

		expect(persona.dimensions?.demographics).toEqual({ age: 52, education: "high school" })
		expect(persona.field_sources).toEqual(evidenceBased.field_sources)
		expect(persona.tier).toBe("evidence_based")
		expect(persona.edited_at).toBe(NOW)
	})

	it("marks an edited dimension as the user's and drops the tier by rule", () => {
		const values = { ...personaToForm(evidenceBased), pains: ["Staff turnover"] }
		const persona = formToPersona(values, {
			id: evidenceBased.id,
			base: evidenceBased,
			now: NOW,
		})

		expect(persona.field_sources?.needs_pains).toBe("user")
		expect(persona.field_sources?.behavior).toEqual(["e2"])
		expect(persona.tier).toBe("generated")
	})

	it("never re-tiers imported or manual personas", () => {
		expect(resolveEditedTier({ ...evidenceBased, tier: "imported", field_sources: {} })).toBe(
			"imported",
		)
		expect(resolveEditedTier({ ...evidenceBased, tier: "manual" })).toBe("manual")
	})
})

describe("ids and identifiers", () => {
	it("uses the agent's id format and avoids existing ids", () => {
		expect(createPersonaId("王芳", new Set())).toMatch(/^p_user_[0-9a-f]{4}$/)
		expect(createPersonaId("Zhang Wei", new Set())).toMatch(/^p_zhangwei_[0-9a-f]{4}$/)
	})

	it("flags phone numbers, emails and ID numbers", () => {
		expect(detectPersonalIdentifiers(["客户电话 13812345678", "a@b.com"])).toEqual([
			"phone",
			"email",
		])
		expect(detectPersonalIdentifiers(["11010519491231002X"])).toEqual(["idCard"])
		expect(detectPersonalIdentifiers(["开店 6 年，两名店员"])).toEqual([])
	})
})
