import { useEffect, useState } from "react"
import { getFileContentsByIds } from "@/pages/superMagic/utils/api"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { usePersonaResearchStore } from "../context"
import { attachmentVersionKey } from "../services/researchFiles"

/**
 * Reads a report template's HTML for the thumbnail and preview, again whenever the file changes
 * (an upload replacing it, or the agent restyling it). `enabled` lets cards wait until visible.
 *
 * | State     | html      | failed |
 * | loading   | null      | false  |
 * | loaded    | the HTML  | false  |
 * | failed    | null      | true   |
 */
export function useReportTemplateHtml(item: AttachmentItem | null, enabled = true) {
	const store = usePersonaResearchStore()
	const [state, setState] = useState<{ html: string | null; failed: boolean }>({
		html: null,
		failed: false,
	})
	const fileId = item?.file_id ? String(item.file_id) : ""
	const version = item ? attachmentVersionKey(item) : ""

	useEffect(() => {
		if (!fileId || !enabled) return
		let cancelled = false
		setState((current) => ({ html: current.html, failed: false }))
		getFileContentsByIds([fileId], {
			responseType: "text",
			forceRefresh: true,
			access: store.fileAccess,
		})
			.then(({ successes }) => {
				if (cancelled) return
				const html = successes.get(fileId)
				setState(
					typeof html === "string"
						? { html, failed: false }
						: { html: null, failed: true },
				)
			})
			.catch(() => {
				if (!cancelled) setState({ html: null, failed: true })
			})
		return () => {
			cancelled = true
		}
	}, [enabled, fileId, store.fileAccess, version])

	return state
}
