import type { EvidenceRef, QuoteRef, StudyHypothesis, SynthesisTheme, ThemeStance } from "../types"

export type VoiceStance = "support" | "partial" | "oppose" | "none"

export interface StanceGroup {
	stance: VoiceStance
	personaIds: string[]
}

export type QuoteEvidence = Extract<EvidenceRef, { kind: "quote" }>

const STANCE_ORDER: VoiceStance[] = ["support", "partial", "oppose", "none"]

/**
 * Who stood where on a hypothesis, from the synthesis themes linked to it (theme.hypothesis_ids).
 * A persona who supports one linked theme and opposes another, or is "mixed" on any, counts as
 * partial. Returns null when no theme is linked: without that link the UI shows only who was
 * quoted, rather than guessing a stance from the quotes.
 */
export function hypothesisStanceGroups(
	hypothesis: Pick<StudyHypothesis, "id">,
	themes: Pick<SynthesisTheme, "hypothesis_ids" | "stance_by_persona">[],
	panelIds: string[],
): StanceGroup[] | null {
	const linked = themes.filter((theme) => theme.hypothesis_ids?.includes(hypothesis.id))
	if (linked.length === 0) return null

	const seen = new Map<string, Set<ThemeStance>>()
	for (const theme of linked) {
		for (const [personaId, stance] of Object.entries(theme.stance_by_persona)) {
			const set = seen.get(personaId) ?? new Set<ThemeStance>()
			set.add(stance)
			seen.set(personaId, set)
		}
	}

	const ids = panelIds.length ? panelIds : [...seen.keys()]
	const byStance = new Map<VoiceStance, string[]>(STANCE_ORDER.map((stance) => [stance, []]))
	for (const personaId of ids) {
		byStance.get(resolveStance(seen.get(personaId)))?.push(personaId)
	}
	return STANCE_ORDER.map((stance) => ({
		stance,
		personaIds: byStance.get(stance) ?? [],
	})).filter((group) => group.personaIds.length > 0)
}

function resolveStance(stances: Set<ThemeStance> | undefined): VoiceStance {
	if (!stances) return "none"
	const support = stances.has("support")
	const oppose = stances.has("oppose")
	if (stances.has("mixed") || (support && oppose)) return "partial"
	if (support) return "support"
	if (oppose) return "oppose"
	return "none"
}

/** Distinct personas quoted as evidence, in citation order. */
export function quotedPersonaIds(hypothesis: Pick<StudyHypothesis, "evidence_refs">): string[] {
	const ids: string[] = []
	for (const ref of hypothesis.evidence_refs ?? []) {
		if (ref.kind === "quote" && !ids.includes(ref.persona_id)) ids.push(ref.persona_id)
	}
	return ids
}

export type LeadQuoteRef = Pick<
	QuoteRef,
	"persona_id" | "text" | "round_index" | "file" | "prompted" | "question"
>

/**
 * The quote that represents a hypothesis: its own quoted evidence first, else a quote from a
 * synthesis theme linked to it (many studies cite interviews only through themes).
 * Preference order: said unprompted, then a full sentence (theme quotes are often clipped).
 * Example: an unprompted "录完谁给我整理？" beats a longer quote the moderator's question led to.
 */
export function leadQuote(
	hypothesis: Pick<StudyHypothesis, "id" | "evidence_refs">,
	themes: Pick<SynthesisTheme, "hypothesis_ids" | "quote_refs">[] = [],
): LeadQuoteRef | null {
	const own = (hypothesis.evidence_refs ?? []).filter(
		(ref): ref is QuoteEvidence => ref.kind === "quote",
	)
	if (own.length) return own.find((ref) => !ref.prompted) ?? own[0]
	const candidates = themes
		.filter((theme) => theme.hypothesis_ids?.includes(hypothesis.id))
		.flatMap((theme) => theme.quote_refs ?? [])
		.filter((ref) => ref.text.trim())
	return (
		candidates.find((ref) => !ref.prompted && isReadableLength(ref.text)) ??
		candidates.find((ref) => isReadableLength(ref.text)) ??
		candidates.reduce<LeadQuoteRef | null>(
			(best, ref) => (!best || ref.text.length > best.text.length ? ref : best),
			null,
		)
	)
}

/** Desk-research sources cited with what they say, for the hypothesis details. */
export function sourceClaims(
	hypothesis: Pick<StudyHypothesis, "evidence_refs">,
): { ref: string; claim: string; covers?: "core" | "context" }[] {
	return (hypothesis.evidence_refs ?? []).flatMap((ref) =>
		ref.kind === "source" && ref.claim?.trim()
			? [{ ref: ref.ref, claim: ref.claim.trim(), covers: ref.covers }]
			: [],
	)
}

const LEAD_MIN = 15
const LEAD_MAX = 90

function isReadableLength(text: string): boolean {
	const length = text.trim().length
	return length >= LEAD_MIN && length <= LEAD_MAX
}

const SOURCE_TOKEN = /\[(S\d+)\]/g

/**
 * Desk-research source ids ("S8") cited by a hypothesis: structured refs first, then ids
 * written inline in the verdict reason, which is how most agent-written studies cite them.
 */
export function sourceRefs(
	hypothesis: Pick<StudyHypothesis, "evidence_refs" | "verdict_reason">,
): string[] {
	const ids = (hypothesis.evidence_refs ?? []).flatMap((ref) =>
		ref.kind === "source" ? [ref.ref] : [],
	)
	for (const match of (hypothesis.verdict_reason ?? "").matchAll(SOURCE_TOKEN)) {
		if (!ids.includes(match[1])) ids.push(match[1])
	}
	return ids
}

export type ReasonSegment = { text: string } | { source: string }

/** Splits a verdict reason so inline "[S8]" tokens can render as source links. */
export function splitSourceTokens(text: string): ReasonSegment[] {
	const segments: ReasonSegment[] = []
	let cursor = 0
	for (const match of text.matchAll(SOURCE_TOKEN)) {
		const start = match.index ?? 0
		if (start > cursor) segments.push({ text: text.slice(cursor, start) })
		segments.push({ source: match[1] })
		cursor = start + match[0].length
	}
	if (cursor < text.length) segments.push({ text: text.slice(cursor) })
	return segments
}
