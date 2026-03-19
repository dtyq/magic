import { useCallback } from "react"
import type { JSONContent } from "@tiptap/react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { openNewTab } from "@/routes/helpers"
import { GuideTourElementId } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import type { GuideItem } from "../types"
import { useLocaleText } from "./useLocaleText"

/** Build a plain-text JSONContent doc for the TipTap editor */
function buildTextJSONContent(text: string): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text }],
			},
		],
	}
}

/**
 * Handles all click_action types defined on a GuideItem.
 *
 * Action matrix:
 *  - no_action          → no-op
 *  - focus_input        → focus the message editor
 *  - fill_content
 *      insert_to_input  → set preset_content in editor and focus
 *      send_immediately → set preset_content and send immediately
 *  - ai_enhancement     → same behaviour as fill_content
 *  - open_url           → open url in a new tab
 *  - upload_file        → focus editor then trigger the upload button
 */
export function useGuideItemAction() {
	const lt = useLocaleText()

	const executeAction = useCallback((item: GuideItem) => {
		const { click_action = "no_action", preset_content, url, execution_method } = item

		switch (click_action) {
			case "no_action":
				break

			case "focus_input":
				// Pass empty payload — handler only focuses when no content supplied
				pubsub.publish(PubSubEvents.Add_Content_To_Chat, {})
				break

			case "fill_content":
			case "ai_enhancement": {
				const presetContent = lt(preset_content) || ""
				if (!presetContent) {
					pubsub.publish(PubSubEvents.Add_Content_To_Chat, {})
					break
				}
				if (execution_method === "send_immediately") {
					pubsub.publish(PubSubEvents.Send_Message_by_Content, {
						jsonContent: buildTextJSONContent(presetContent),
					})
				} else {
					// Default: insert_to_input
					pubsub.publish(PubSubEvents.Set_Input_Message, presetContent)
				}
				break
			}

			case "open_url":
				openNewTab(url)
				break

			case "upload_file":
				// Focus editor then click the upload button in the MessageEditor toolbar
				pubsub.publish(PubSubEvents.Add_Content_To_Chat, {})
				requestAnimationFrame(() => {
					document.getElementById(GuideTourElementId.UploadFileButton)?.click()
				})
				break

			default:
				break
		}
	}, [])

	return { executeAction }
}
