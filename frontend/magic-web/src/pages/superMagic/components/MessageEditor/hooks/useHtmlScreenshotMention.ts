import { useEffect, useState } from "react"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	createLocalScreenshotMention,
	getHtmlScreenshotMention,
	subscribeHtmlScreenshotTarget,
} from "../services/HtmlScreenshotTargetStore"

/** Resolve a screenshot mention from node attrs or the in-memory capture store. */
export function useHtmlScreenshotMention(
	captureId?: string | null,
	fallback?: TiptapMentionAttributes | null,
): TiptapMentionAttributes | null {
	const [storeMention, setStoreMention] = useState<TiptapMentionAttributes | null>(() =>
		captureId ? (getHtmlScreenshotMention(captureId) ?? null) : null,
	)

	useEffect(() => {
		if (!captureId) {
			setStoreMention(null)
			return
		}

		setStoreMention(getHtmlScreenshotMention(captureId) ?? null)
		return subscribeHtmlScreenshotTarget(captureId, () => {
			setStoreMention(getHtmlScreenshotMention(captureId) ?? null)
		})
	}, [captureId])

	if (fallback) return fallback
	if (storeMention) return storeMention
	return captureId ? createLocalScreenshotMention(captureId) : null
}
