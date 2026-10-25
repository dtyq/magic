import type {
	DecisionWeight,
	InterviewFile,
	QualitativeLevel,
	TranscriptQuality,
	TranscriptRound,
} from "../types"

/** Marker persona_chat appends after details the persona invented beyond its profile. */
export const INFERRED_MARKER = "(inferred)"

export interface TextSegment {
	text: string
	inferred: boolean
}

/**
 * Splits an answer into plain and inferred segments for highlighting.
 * The sentence (or clause) that ends with "(inferred)" is the inferred part; the marker itself
 * is removed from the displayed text.
 * Example: "我们有 12 家店。去年关了 2 家 (inferred)，主要是租金。"
 *   → [{"我们有 12 家店。"}, {"去年关了 2 家", inferred}, {"，主要是租金。"}]
 */
export function splitInferredSegments(text: string): TextSegment[] {
	if (!text.includes(INFERRED_MARKER)) return [{ text, inferred: false }]
	const segments: TextSegment[] = []
	let rest = text
	while (rest.includes(INFERRED_MARKER)) {
		const markerIndex = rest.indexOf(INFERRED_MARKER)
		const before = rest.slice(0, markerIndex)
		// The inferred span starts after the previous sentence or clause boundary.
		const boundary = Math.max(
			...["。", "！", "？", ".", "!", "?", "，", ",", "；", ";", "\n"].map((mark) =>
				before.lastIndexOf(mark),
			),
		)
		const plain = before.slice(0, boundary + 1)
		const inferred = before.slice(boundary + 1).trimEnd()
		if (plain) segments.push({ text: plain, inferred: false })
		if (inferred) segments.push({ text: inferred, inferred: true })
		rest = rest.slice(markerIndex + INFERRED_MARKER.length)
	}
	if (rest) segments.push({ text: rest, inferred: false })
	return segments
}

/**
 * Share of respondent sentences marked "(inferred)" — the client-side fallback when the
 * interviewer did not write quality.inferred_ratio. Example: 10 sentences, 3 marked → 0.3.
 */
export function computeInferredRatio(rounds: TranscriptRound[]): number {
	let total = 0
	let inferred = 0
	for (const round of rounds) {
		const speaker = round.speaker ?? round.role
		if (!speaker || speaker === "moderator") continue
		const sentences = round.text
			.split(/(?<=[。！？.!?\n])/)
			.map((sentence) => sentence.trim())
			.filter(Boolean)
		total += sentences.length
		inferred += sentences.filter((sentence) => sentence.includes(INFERRED_MARKER)).length
	}
	return total === 0 ? 0 : inferred / total
}

/** Interviews at or above this share of inferred content are flagged and downweighted. */
export const HIGH_INFERRED_RATIO = 0.4

/** Quality shown for a transcript: the interviewer's numbers win, the ratio falls back to text. */
export function resolveTranscriptQuality(transcript: Pick<InterviewFile, "rounds" | "quality">): {
	quality: TranscriptQuality | undefined
	inferredRatio: number
	isHighInferred: boolean
} {
	const inferredRatio =
		transcript.quality?.inferred_ratio ?? computeInferredRatio(transcript.rounds)
	return {
		quality: transcript.quality,
		inferredRatio,
		isHighInferred: inferredRatio >= HIGH_INFERRED_RATIO,
	}
}

/**
 * Normalizes decision weights to qualitative levels; never exposes decimals.
 * New files: [{factor, level}]. Early files: {价格: 0.4, 关系: 0.2} → ranked by value,
 * top third "high", middle "medium", rest "low".
 */
export function normalizeDecisionWeights(value: unknown): DecisionWeight[] {
	if (Array.isArray(value)) {
		return value.filter(
			(item): item is DecisionWeight =>
				Boolean(item) &&
				typeof (item as DecisionWeight).factor === "string" &&
				["high", "medium", "low"].includes((item as DecisionWeight).level),
		)
	}
	if (!value || typeof value !== "object") return []
	const entries = Object.entries(value as Record<string, unknown>)
		.map(([factor, weight]) => ({ factor, weight: Number(weight) }))
		.filter((entry) => Number.isFinite(entry.weight))
		.sort((a, b) => b.weight - a.weight)
	return entries.map((entry, index) => {
		const position = entries.length <= 1 ? 0 : index / (entries.length - 1)
		const level: QualitativeLevel =
			position < 1 / 3 ? "high" : position < 2 / 3 ? "medium" : "low"
		return { factor: entry.factor, level }
	})
}

export const LEVEL_SCORE: Record<QualitativeLevel, number> = { high: 3, medium: 2, low: 1 }

/**
 * Radar charts read well only with 5–8 axes and 2–3 series; otherwise grouped bars are clearer.
 * Example: 6 factors × 2 segments → radar; 4 factors × 2 segments → bars.
 */
export function chooseDimensionChart(
	dimensionCount: number,
	segmentCount: number,
): "radar" | "bar" {
	return dimensionCount >= 5 && dimensionCount <= 8 && segmentCount >= 2 && segmentCount <= 3
		? "radar"
		: "bar"
}
