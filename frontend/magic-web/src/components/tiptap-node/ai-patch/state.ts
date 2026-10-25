import {
	PluginKey,
	type EditorState,
	type Transaction,
} from "@/infrastructure/editors/tiptap/pm-state"
import { closeHistory } from "@/infrastructure/editors/tiptap/pm-history"
import type { Node as PMNode } from "@/infrastructure/editors/tiptap/pm-model"
import type { AiPatchItem, AiPatchMeta, AiPatchState } from "./types"

export const aiPatchPluginKey = new PluginKey<AiPatchState>("aiPatch")

export function initialAiPatchState(): AiPatchState {
	return {
		patches: [],
		phase: "idle",
		revision: 0,
		invalidatedCount: 0,
		appliedRevision: 0,
		highlights: [],
	}
}

export function getAiPatchState(state: EditorState): AiPatchState {
	return aiPatchPluginKey.getState(state) || initialAiPatchState()
}

export function matchesOriginal(doc: PMNode, patch: AiPatchItem): boolean {
	return (
		patch.from >= 0 &&
		patch.to <= doc.content.size &&
		doc.slice(patch.from, patch.to).eq(patch.oldContent)
	)
}

function mapPatch(patch: AiPatchItem, tr: Transaction): AiPatchItem | null {
	let { from, to } = patch
	let overlaps = false
	for (const [index, map] of tr.mapping.maps.entries()) {
		const step = tr.steps[index].toJSON() as { stepType: string; from?: number; to?: number }
		// Mark steps carry empty maps, including marks that touch a pending insertion point.
		if (
			(step.stepType === "addMark" || step.stepType === "removeMark") &&
			typeof step.from === "number" &&
			typeof step.to === "number" &&
			(from === to ? step.from <= from && step.to >= from : step.from < to && step.to > from)
		)
			overlaps = true
		map.forEach((start, end) => {
			// Boundary insertions can be mapped safely; edits inside a suggestion cannot.
			if (from === to ? start <= from && end >= from : start < to && end > from)
				overlaps = true
		})
		from = map.map(from, 1)
		to = map.map(to, -1)
	}
	const mapped = { ...patch, from, to }
	return !overlaps && from <= to && matchesOriginal(tr.doc, mapped) ? mapped : null
}

export function applyAiPatchTransaction(tr: Transaction, previous: AiPatchState): AiPatchState {
	const meta = tr.getMeta(aiPatchPluginKey) as AiPatchMeta | undefined
	const revision = previous.revision + (tr.docChanged ? 1 : 0)
	let next = { ...previous, revision }
	if (tr.docChanged) {
		const accepted = new Set(meta?.type === "accept" ? meta.ids : [])
		let invalidated = 0
		const patches = previous.patches.flatMap((patch) => {
			if (accepted.has(patch.id)) return []
			const mapped = mapPatch(patch, tr)
			if (!mapped) invalidated++
			return mapped ? [{ ...mapped, revision }] : []
		})
		// Schema-normalizing plugins can append a transaction (for example a trailing paragraph).
		// Preserve the animation ranges across those non-overlapping changes as well.
		const highlights = previous.highlights.flatMap((range) => {
			const from = tr.mapping.mapResult(range.from, 1)
			const to = tr.mapping.mapResult(range.to, -1)
			return !from.deletedAcross && !to.deletedAcross && from.pos < to.pos
				? [{ from: from.pos, to: to.pos }]
				: []
		})
		next = {
			...next,
			patches,
			invalidatedCount: previous.invalidatedCount + invalidated,
			highlights,
		}
		if (!patches.length) next.phase = highlights.length ? "inserted" : "idle"
	}
	if (meta?.type === "propose")
		return {
			...next,
			patches: meta.patches,
			phase: meta.patches.length ? (meta.autoApply ? "removing" : "review") : "idle",
			invalidatedCount: 0,
			highlights: [],
		}
	if (meta?.type === "accept")
		return {
			...next,
			phase: next.patches.length ? "review" : "inserted",
			highlights: meta.highlights,
			appliedRevision: previous.appliedRevision + (tr.docChanged ? 1 : 0),
		}
	if (meta?.type === "reject") {
		const patches = next.patches.filter((patch) => !meta.ids.includes(patch.id))
		return { ...next, patches, phase: patches.length ? next.phase : "idle" }
	}
	if (meta?.type === "clear") return { ...next, patches: [], highlights: [], phase: "idle" }
	if (meta?.type === "finish")
		return { ...next, highlights: [], phase: next.patches.length ? next.phase : "idle" }
	return next
}

export function acceptPatches(
	state: EditorState,
	id?: string,
	transaction = state.tr,
): Transaction | null {
	const patches = getAiPatchState(state).patches.filter((patch) => !id || patch.id === id)
	if (!patches.length || patches.some((patch) => !matchesOriginal(state.doc, patch))) return null
	const tr = closeHistory(transaction)
	const highlights: AiPatchState["highlights"] = []
	// Descending replacements retain original positions. Map each inserted range through later steps.
	for (const patch of [...patches].sort((left, right) => right.from - left.from)) {
		tr.replace(patch.from, patch.to, patch.replacement)
		const lastMap = tr.mapping.maps[tr.mapping.maps.length - 1]
		for (const range of highlights) {
			range.from = lastMap.map(range.from, 1)
			range.to = lastMap.map(range.to, -1)
		}
		if (patch.replacement.size)
			highlights.push({ from: patch.from, to: patch.from + patch.replacement.size })
	}
	return tr.setMeta(aiPatchPluginKey, {
		type: "accept",
		ids: patches.map((patch) => patch.id),
		highlights,
	} satisfies AiPatchMeta)
}
