import { DOMSerializer, type Node as PMNode } from "@/infrastructure/editors/tiptap/pm-model"
import { Decoration, DecorationSet } from "@/infrastructure/editors/tiptap/pm-view"
import type { AiPatchState } from "./types"

export function createPatchDecorations(doc: PMNode, state: AiPatchState): DecorationSet {
	const decorations: Decoration[] = []
	for (const patch of state.patches) {
		const className = `ai-patch-removed${state.phase === "removing" ? " ai-patch-removing" : ""}`
		if (patch.from < patch.to)
			decorations.push(
				Decoration.inline(patch.from, patch.to, {
					class: className,
					"data-ai-patch-id": patch.id,
				}),
			)
		if (patch.replacement.size && state.phase === "review") {
			decorations.push(
				Decoration.widget(
					patch.to,
					() => {
						const element = document.createElement(
							patch.kind === "block" ? "div" : "span",
						)
						element.className = "ai-patch-preview"
						element.dataset.aiPatchId = patch.id
						element.contentEditable = "false"
						// The schema serializer preserves marks and list/heading structure without raw HTML injection.
						element.appendChild(
							DOMSerializer.fromSchema(doc.type.schema).serializeFragment(
								patch.replacement.content,
							),
						)
						return element
					},
					{ key: `${patch.id}-preview`, side: 1 },
				),
			)
		}
	}
	for (const range of state.highlights)
		if (range.from < range.to)
			decorations.push(Decoration.inline(range.from, range.to, { class: "ai-patch-added" }))
	return DecorationSet.create(doc, decorations)
}
