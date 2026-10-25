import { useCallback, useState } from "react"

/** Advance the iframe key only for accepted preview content or explicit reset. */
export function usePreviewDocumentRevision(content: string, isEditing = false) {
	const [document, setDocument] = useState({ content, revision: 0 })
	// Adjust during render so React replaces the iframe before committing effects
	// for the new source. Editing changes preserve the current document and draft.
	if (!isEditing && document.content !== content) {
		setDocument({ content, revision: document.revision + 1 })
	}
	const restart = useCallback(() => {
		setDocument((current) => ({ content, revision: current.revision + 1 }))
	}, [content])
	return { revision: document.revision, restart }
}
