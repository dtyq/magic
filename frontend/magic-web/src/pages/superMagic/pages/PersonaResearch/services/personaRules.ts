import type {
	DecisionWeight,
	PersonaDimensionKey,
	PersonaFieldSource,
	PersonaFile,
	PersonaTier,
	QualitativeLevel,
} from "../types"
import { normalizeDecisionWeights } from "./researchAnalysis"

/**
 * Rules for personas the user writes in the persona library (manual form and edits).
 * The tier rule mirrors backend save_personas `_tier`; keep both in sync.
 */

export const PERSONA_DIMENSION_KEYS: PersonaDimensionKey[] = [
	"demographics",
	"geography",
	"psychographics",
	"behavior",
	"needs_pains",
	"tech_adoption",
	"social",
]

const EXTERNAL_EVIDENCE_TYPES = new Set(["web", "social", "upload"])

/**
 * Tier after the user edits a persona.
 *
 * | Current tier          | After edit                                                  |
 * | imported, manual      | unchanged: the source of the persona did not change         |
 * | evidence_based        | stays only while needs_pains and behavior still cite ≥3     |
 * |                       | external evidence items; a field rewritten by the user is   |
 * |                       | "user", so editing either one drops it to generated         |
 * | generated             | evidence_based only if the rule now holds (normally not)    |
 */
export function resolveEditedTier(persona: PersonaFile): PersonaTier {
	if (persona.tier === "imported" || persona.tier === "manual") return persona.tier
	const external = new Set(
		(persona.evidence ?? [])
			.filter((item) => EXTERNAL_EVIDENCE_TYPES.has(item.type))
			.map((item) => item.id),
	)
	const cites = (key: PersonaDimensionKey) => {
		const source = persona.field_sources?.[key]
		return Array.isArray(source) && source.some((id) => external.has(id))
	}
	return external.size >= 3 && cites("needs_pains") && cites("behavior")
		? "evidence_based"
		: "generated"
}

/** ASCII part of a name for the persona id; Chinese names fall back to "user". */
export function asciiSlug(text: string, maxLength = 20): string {
	return text
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.slice(0, maxLength)
}

function randomHex(): string {
	const bytes = new Uint8Array(2)
	crypto.getRandomValues(bytes)
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Same format the agent uses: p_<slug>_<4 hex>, e.g. "p_wang_9c2e" or "p_user_1f0a".
 * Retries on collision with ids already in the library.
 */
export function createPersonaId(name: string, existingIds: ReadonlySet<string>): string {
	const slug = asciiSlug(name) || "user"
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const id = `p_${slug}_${randomHex()}`
		if (!existingIds.has(id)) return id
	}
	throw new Error("persona_id_exhausted")
}

/** ISO 8601 time with the local offset, matching the agent's updated_at format. */
export function nowIsoWithOffset(date = new Date()): string {
	const pad = (value: number) => String(Math.abs(value)).padStart(2, "0")
	const offset = -date.getTimezoneOffset()
	const sign = offset >= 0 ? "+" : "-"
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
		`${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
	)
}

/**
 * Personal identifiers that should not be stored in a persona written from a real customer.
 * Only a hint: the user may keep the text after the warning.
 */
export function detectPersonalIdentifiers(texts: string[]): ("phone" | "email" | "idCard")[] {
	const joined = texts.join("\n")
	const found: ("phone" | "email" | "idCard")[] = []
	if (/(?<!\d)1[3-9]\d{9}(?!\d)/.test(joined)) found.push("phone")
	if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(joined)) found.push("email")
	if (/(?<!\d)\d{17}[\dXx](?!\d)/.test(joined)) found.push("idCard")
	return found
}

// ---------------------------------------------------------------------------
// Form model. The form covers the common contract keys; editing keeps every other key of an
// AI persona untouched, e.g. demographics.education written by the agent survives an edit.
// ---------------------------------------------------------------------------

export interface PersonaFormValues {
	name: string
	tagline: string
	tags: string
	age: string
	gender: string
	occupation: string
	income: string
	cityTier: string
	region: string
	pains: string[]
	story: string
	purchaseChannel: string
	device: string
	techAdoption: string
	values: string
	riskAttitude: string
	social: string
	expression: string
	decisionWeights: { factor: string; level: QualitativeLevel }[]
	actions: string
	consistencyNotes: string
}

export type PersonaFormField = keyof PersonaFormValues

/** Required: what persona_chat leans on most to play a believable person. */
export const REQUIRED_PERSONA_FIELDS: PersonaFormField[] = [
	"name",
	"tagline",
	"age",
	"occupation",
	"pains",
	"story",
]

export function isFieldFilled(values: PersonaFormValues, field: PersonaFormField): boolean {
	const value = values[field]
	if (Array.isArray(value)) {
		return value.some((item) => (typeof item === "string" ? item.trim() : item.factor.trim()))
	}
	return value.trim().length > 0
}

export function missingRequiredFields(values: PersonaFormValues): PersonaFormField[] {
	return REQUIRED_PERSONA_FIELDS.filter((field) => !isFieldFilled(values, field))
}

/** Share of form fields filled, 0–100, for the completeness meter. */
export function formCompleteness(values: PersonaFormValues): number {
	const fields = Object.keys(values) as PersonaFormField[]
	const filled = fields.filter((field) => isFieldFilled(values, field)).length
	return Math.round((filled / fields.length) * 100)
}

const asText = (value: unknown): string =>
	value === undefined || value === null
		? ""
		: Array.isArray(value)
			? value.join("、")
			: String(value)
const asLines = (value: unknown): string =>
	Array.isArray(value) ? value.map(asText).filter(Boolean).join("\n") : asText(value)
const splitList = (text: string): string[] =>
	text
		.split(/[,，、\n]/)
		.map((item) => item.trim())
		.filter(Boolean)
const splitLines = (text: string): string[] =>
	text
		.split("\n")
		.map((item) => item.trim())
		.filter(Boolean)
const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}

export function emptyPersonaForm(): PersonaFormValues {
	return {
		name: "",
		tagline: "",
		tags: "",
		age: "",
		gender: "",
		occupation: "",
		income: "",
		cityTier: "",
		region: "",
		pains: [""],
		story: "",
		purchaseChannel: "",
		device: "",
		techAdoption: "",
		values: "",
		riskAttitude: "",
		social: "",
		expression: "",
		decisionWeights: [{ factor: "", level: "high" }],
		actions: "",
		consistencyNotes: "",
	}
}

export function personaToForm(persona: PersonaFile): PersonaFormValues {
	const dimensions = persona.dimensions ?? {}
	const demographics = record(dimensions.demographics)
	const geography = record(dimensions.geography)
	const psychographics = record(dimensions.psychographics)
	const behavior = record(dimensions.behavior)
	const pains = (dimensions.needs_pains ?? []).map(asText).filter(Boolean)
	const weights: DecisionWeight[] = normalizeDecisionWeights(
		persona.layers?.cognition?.decision_weights,
	)
	return {
		name: persona.name,
		tagline: persona.tagline ?? "",
		tags: (persona.tags ?? []).join("，"),
		age: asText(demographics.age),
		gender: asText(demographics.gender),
		occupation: asText(demographics.occupation),
		income: asText(demographics.income),
		cityTier: asText(geography.city_tier),
		region: asText(geography.region),
		pains: pains.length ? pains : [""],
		story: persona.layers?.story ?? "",
		purchaseChannel: asText(behavior.purchase_channel),
		device: asText(behavior.device),
		techAdoption: dimensions.tech_adoption ?? "",
		values: asText(psychographics.values),
		riskAttitude: asText(psychographics.risk_attitude),
		social: dimensions.social ?? "",
		expression: asLines(persona.layers?.expression),
		decisionWeights: weights.length
			? weights.map(({ factor, level }) => ({ factor, level }))
			: [{ factor: "", level: "high" }],
		actions: asLines(persona.layers?.behavior),
		consistencyNotes: (persona.consistency_notes ?? []).join("\n"),
	}
}

/**
 * Sets or removes keys on a copy of an object dimension; returns undefined when it ends empty.
 * A value the form shows unchanged keeps its original type, e.g. the agent's age 52 is not
 * rewritten as "52" — otherwise opening and saving would mark the dimension as edited.
 */
function mergeRecord(
	base: unknown,
	patch: Record<string, string | string[]>,
): Record<string, unknown> | undefined {
	const original = record(base)
	const next: Record<string, unknown> = { ...original }
	for (const [key, value] of Object.entries(patch)) {
		const empty = Array.isArray(value) ? value.length === 0 : !value.trim()
		const shown = Array.isArray(value) ? value.join("、") : value.trim()
		if (empty) delete next[key]
		else if (key in original && asText(original[key]) === shown) next[key] = original[key]
		else next[key] = Array.isArray(value) ? value : value.trim()
	}
	return Object.keys(next).length ? next : undefined
}

function isEmptyValue(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0) ||
		(typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
	)
}

function sameValue(a: unknown, b: unknown): boolean {
	return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/**
 * Builds the persona file from the form.
 *
 * | Case                 | tier                 | field_sources                                        |
 * | New (manual form)    | manual               | "user" for every filled dimension                    |
 * | Edit of a persona    | resolveEditedTier()  | changed dimensions become "user", others unchanged   |
 *
 * Example: editing needs_pains of an evidence_based persona → needs_pains: "user", and the
 * tier drops to generated because needs_pains no longer cites evidence.
 */
export function formToPersona(
	values: PersonaFormValues,
	options: { id: string; base?: PersonaFile; now?: string },
): PersonaFile {
	const { id, base } = options
	const now = options.now ?? nowIsoWithOffset()
	const baseDimensions = base?.dimensions ?? {}
	const dimensions: NonNullable<PersonaFile["dimensions"]> = {
		demographics: mergeRecord(baseDimensions.demographics, {
			age: values.age,
			gender: values.gender,
			occupation: values.occupation,
			income: values.income,
		}),
		geography: mergeRecord(baseDimensions.geography, {
			city_tier: values.cityTier,
			region: values.region,
		}),
		psychographics: mergeRecord(baseDimensions.psychographics, {
			values: splitList(values.values),
			risk_attitude: values.riskAttitude,
		}),
		behavior: mergeRecord(baseDimensions.behavior, {
			purchase_channel: values.purchaseChannel,
			device: values.device,
		}),
		needs_pains: values.pains.map((item) => item.trim()).filter(Boolean),
		tech_adoption: values.techAdoption.trim(),
		social: values.social.trim(),
	}
	for (const key of PERSONA_DIMENSION_KEYS) {
		if (isEmptyValue(dimensions[key])) delete dimensions[key]
	}

	const fieldSources: Record<string, PersonaFieldSource> = base
		? { ...(base.field_sources ?? {}) }
		: {}
	for (const key of PERSONA_DIMENSION_KEYS) {
		const changed = !sameValue(dimensions[key], baseDimensions[key])
		if (dimensions[key] === undefined) {
			if (changed) delete fieldSources[key]
		} else if (!base || changed) {
			fieldSources[key] = "user"
		}
	}

	const decisionWeights = values.decisionWeights
		.map((weight) => ({ factor: weight.factor.trim(), level: weight.level }))
		.filter((weight) => weight.factor)
	const layers: NonNullable<PersonaFile["layers"]> = { ...(base?.layers ?? {}) }
	const setLayer = <K extends keyof typeof layers>(key: K, value: (typeof layers)[K]) => {
		if (isEmptyValue(value)) delete layers[key]
		else layers[key] = value
	}
	setLayer("expression", splitLines(values.expression))
	setLayer("story", values.story.trim())
	setLayer(
		"cognition",
		decisionWeights.length
			? { ...(base?.layers?.cognition ?? {}), decision_weights: decisionWeights }
			: undefined,
	)
	setLayer("behavior", splitLines(values.actions))

	const persona: PersonaFile = {
		...(base ?? {}),
		schema_version: 1,
		id,
		name: values.name.trim(),
		tagline: values.tagline.trim() || undefined,
		tags: splitList(values.tags).slice(0, 6),
		tier: base?.tier ?? "manual",
		dimensions,
		layers,
		field_sources: fieldSources,
		consistency_notes: splitLines(values.consistencyNotes),
		updated_at: now,
	}
	if (base) {
		persona.edited_at = now
		persona.tier = resolveEditedTier(persona)
	}
	return persona
}
