import { useCallback, useEffect, useRef, useState } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import { HTML_CODE_BLOCK_PREVIEW_COPY_FEEDBACK_DURATION } from "../constants"

interface HtmlCodeBlockPreviewCopyHookOptions {
	onCopySuccess?: () => void
	onCopyFailed?: () => void
}

export function useHtmlCodeBlockPreviewCopy(options: HtmlCodeBlockPreviewCopyHookOptions = {}) {
	const { onCopySuccess, onCopyFailed } = options
	const [isCopied, setIsCopied] = useState(false)
	const copyResetTimerRef = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current)
		}
	}, [])

	const copyHtmlCode = useCallback(
		async (code: string) => {
			try {
				await clipboard.writeText(code.trimEnd())
				onCopySuccess?.()
				setIsCopied(true)

				if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current)

				copyResetTimerRef.current = window.setTimeout(() => {
					setIsCopied(false)
				}, HTML_CODE_BLOCK_PREVIEW_COPY_FEEDBACK_DURATION)
			} catch {
				onCopyFailed?.()
			}
		},
		[onCopyFailed, onCopySuccess],
	)

	return {
		isCopied,
		copyHtmlCode,
	}
}
