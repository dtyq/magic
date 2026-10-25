import { createNodeFromContent, type Editor } from "@/infrastructure/editors/tiptap/core"
import DOMPurify from "dompurify"
import type { ProposeAiPatchOptions } from "./types"

export { AiPatch } from "./extension"
export { getAiPatchState } from "./state"
export type { AiPatchItem, AiPatchState, ProposeAiPatchOptions } from "./types"

export function proposeAiPatchMarkdown(
	editor: Editor,
	markdown: string,
	options: ProposeAiPatchOptions = {},
): boolean {
	if (!markdown.trim()) return false
	try {
		// Use the installed Markdown extension's parser and this editor's schema, never raw string offsets.
		const storage = editor.storage as unknown as {
			markdown?: { parser?: { parse: (content: string) => string } }
		}
		if (!storage.markdown?.parser) return false
		// Custom schema extensions can override their own URL validation, so sanitize model HTML first.
		const html = DOMPurify.sanitize(storage.markdown.parser.parse(markdown), {
			USE_PROFILES: { html: true },
		})
		if (!html.trim()) return false
		const parsed = createNodeFromContent(html, editor.schema, { slice: false })
		return editor.commands.proposeAiPatch(parsed.toJSON(), options)
	} catch {
		return false
	}
}
