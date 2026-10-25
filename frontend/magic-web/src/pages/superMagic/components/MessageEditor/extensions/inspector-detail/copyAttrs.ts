import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	MentionItemType,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import type { InspectorDetailAttrs } from "./types"

function isLocalHtmlScreenshotMention(mention?: TiptapMentionAttributes | null): boolean {
	if (!mention || mention.type !== MentionItemType.UPLOAD_FILE) return false
	const data = mention.data as UploadFileMentionData
	return Boolean(data.is_html_screenshot || data.storage_id)
}

type CopiedInspectorDetailAttrs<T> = Omit<T, "captureId" | "screenshotMention"> &
	Pick<InspectorDetailAttrs, "captureId" | "screenshotMention">

/** Drop live screenshot bindings when copying history into the editor. */
export function sanitizeCopiedInspectorDetailAttrs<
	T extends Pick<InspectorDetailAttrs, "captureId" | "screenshotMention">,
>(attrs: T): CopiedInspectorDetailAttrs<T> {
	return {
		...attrs,
		captureId: null,
		screenshotMention: isLocalHtmlScreenshotMention(attrs.screenshotMention)
			? null
			: attrs.screenshotMention,
	}
}
