import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { Slice } from "@/infrastructure/editors/tiptap/pm-model"

export interface AiPatchItem {
	id: string
	from: number
	to: number
	kind: "inline" | "block"
	oldText: string
	newText: string
	oldContent: Slice
	replacement: Slice
	revision: number
}

export interface AiPatchState {
	patches: AiPatchItem[]
	phase: "idle" | "review" | "removing" | "inserted"
	revision: number
	invalidatedCount: number
	appliedRevision: number
	highlights: { from: number; to: number }[]
}

export interface ProposeAiPatchOptions {
	autoApply?: boolean
	/** The request snapshot prevents a late model response from overwriting newer edits. */
	expectedDoc?: JSONContent
}

export type AiPatchMeta =
	| { type: "propose"; patches: AiPatchItem[]; autoApply: boolean }
	| { type: "accept"; ids: string[]; highlights: AiPatchState["highlights"] }
	| { type: "reject"; ids: string[] }
	| { type: "clear" }
	| { type: "finish" }
