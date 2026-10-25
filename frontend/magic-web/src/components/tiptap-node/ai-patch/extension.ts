import { Extension, type JSONContent } from "@/infrastructure/editors/tiptap/core"
import { Plugin } from "@/infrastructure/editors/tiptap/pm-state"
import { closeHistory } from "@/infrastructure/editors/tiptap/pm-history"
import { diffDocuments } from "./diff"
import { createPatchDecorations } from "./decorations"
import {
	acceptPatches,
	aiPatchPluginKey,
	applyAiPatchTransaction,
	getAiPatchState,
	initialAiPatchState,
} from "./state"
import type { AiPatchMeta, ProposeAiPatchOptions } from "./types"
import "./ai-patch.css"

declare module "@/infrastructure/editors/tiptap/core" {
	interface Commands<ReturnType> {
		aiPatch: {
			proposeAiPatch: (targetDoc: JSONContent, options?: ProposeAiPatchOptions) => ReturnType
			acceptAiPatch: (id?: string) => ReturnType
			rejectAiPatch: (id?: string) => ReturnType
			clearAiPatches: () => ReturnType
		}
	}
}

export const AiPatch = Extension.create({
	name: "aiPatch",
	addCommands() {
		return {
			proposeAiPatch:
				(targetDoc, options = {}) =>
				({ editor, state, tr, dispatch }) => {
					if (!editor.isEditable) return false
					try {
						if (
							options.expectedDoc &&
							!state.doc.eq(state.schema.nodeFromJSON(options.expectedDoc))
						)
							return false
						const target = state.schema.nodeFromJSON(targetDoc)
						target.check()
						if (target.type !== state.schema.topNodeType) return false
						const patches = diffDocuments(
							state.doc,
							target,
							getAiPatchState(state).revision,
						)
						if (dispatch)
							tr.setMeta(aiPatchPluginKey, {
								type: "propose",
								patches,
								autoApply: options.autoApply ?? true,
							} satisfies AiPatchMeta).setMeta("addToHistory", false)
						return true
					} catch {
						return false
					}
				},
			acceptAiPatch:
				(id) =>
				({ editor, state, tr, dispatch }) => {
					if (!editor.isEditable) return false
					if (!dispatch) return !!acceptPatches(state, id)
					return !!acceptPatches(state, id, tr)
				},
			rejectAiPatch:
				(id) =>
				({ state, tr, dispatch }) => {
					const patches = getAiPatchState(state).patches.filter(
						(patch) => !id || patch.id === id,
					)
					if (!patches.length) return false
					if (dispatch)
						tr.setMeta(aiPatchPluginKey, {
							type: "reject",
							ids: patches.map((patch) => patch.id),
						} satisfies AiPatchMeta).setMeta("addToHistory", false)
					return true
				},
			clearAiPatches:
				() =>
				({ tr, dispatch }) => {
					if (dispatch)
						tr.setMeta(aiPatchPluginKey, {
							type: "clear",
						} satisfies AiPatchMeta).setMeta("addToHistory", false)
					return true
				},
		}
	},
	addProseMirrorPlugins() {
		const editor = this.editor
		return [
			new Plugin({
				key: aiPatchPluginKey,
				state: { init: initialAiPatchState, apply: applyAiPatchTransaction },
				props: {
					decorations: (state) =>
						createPatchDecorations(state.doc, getAiPatchState(state)),
				},
				appendTransaction: (transactions, _old, state) => {
					// Keep an accepted suggestion separate from both preceding and following user typing.
					if (
						transactions.some(
							(tr) =>
								(tr.getMeta(aiPatchPluginKey) as AiPatchMeta | undefined)?.type ===
								"accept",
						)
					)
						return closeHistory(state.tr).setMeta("addToHistory", false)
					return null
				},
				view: (view) => {
					let timer: ReturnType<typeof setTimeout> | undefined
					let signature = ""
					function update() {
						const state = getAiPatchState(view.state)
						const nextSignature = `${state.phase}:${state.revision}:${state.patches.map((patch) => patch.id).join(",")}:${state.highlights.length}:${editor.isEditable}`
						if (signature === nextSignature) return
						signature = nextSignature
						clearTimeout(timer)
						if (state.phase === "removing" && editor.isEditable) {
							const reducedMotion =
								typeof window.matchMedia === "function" &&
								window.matchMedia("(prefers-reduced-motion: reduce)").matches
							timer = setTimeout(
								() => {
									if (editor.isDestroyed || !editor.isEditable) return
									const tr = acceptPatches(view.state)
									if (tr) view.dispatch(tr)
								},
								reducedMotion ? 0 : 180,
							)
						} else if (state.highlights.length || state.phase === "inserted") {
							timer = setTimeout(() => {
								if (!editor.isDestroyed)
									view.dispatch(
										view.state.tr
											.setMeta(aiPatchPluginKey, {
												type: "finish",
											} satisfies AiPatchMeta)
											.setMeta("addToHistory", false),
									)
							}, 220)
						}
					}
					return { update, destroy: () => clearTimeout(timer) }
				},
			}),
		]
	},
})
