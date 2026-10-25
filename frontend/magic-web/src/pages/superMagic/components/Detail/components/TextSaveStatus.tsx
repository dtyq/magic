import { HtmlPreviewFreshness } from "../contents/HTML/components/HtmlPreviewFreshness"
import { useSaveConfirmation } from "../contents/HTML/hooks/useSaveConfirmation"
import type { TextFileSession } from "../types"

interface TextSaveStatusProps {
	fileId?: string
	/** Standalone sessions (user space) own their save lifecycle instead of the file save queue. */
	textFileSession?: TextFileSession
}

function noop() {}

/**
 * Save feedback for text-like editors (Markdown, plain text, code).
 * Reuses the HTML editor's top-right status chip instead of a centered toast.
 */
export function TextSaveStatus({ fileId, textFileSession }: TextSaveStatusProps) {
	const queueStage = useSaveConfirmation(textFileSession ? undefined : fileId, true)
	const saveStage = textFileSession ? (textFileSession.saveStage ?? "idle") : queueStage

	return (
		// Zero-height anchor below the header: the chip's absolute top-right offset is
		// measured from the content area, so it never covers the header actions.
		<div className="relative z-30 h-0 shrink-0" data-testid="text-save-status-anchor">
			<HtmlPreviewFreshness
				phase="idle"
				hasRendered={false}
				previewStatusEnabled={false}
				saveStage={saveStage}
				onRetry={noop}
			/>
		</div>
	)
}
