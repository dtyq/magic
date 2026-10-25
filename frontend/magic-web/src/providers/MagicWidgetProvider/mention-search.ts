import type { MagicWidgetEmbedContext } from "./types"
import type { MagicWidget } from "@magic-web/widget-sdk"

const MAGIC_WIDGET_PROTOCOL = "magic-widget"
const MAGIC_WIDGET_PROTOCOL_VERSION = 1

type SearchScope = MagicWidget.CustomMentionSearchContext["scope"]

/** Generates a request identity that is local to one iframe search bridge. */
function createRequestId(): string {
	return `mention-search-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** Requests host-owned custom Mention results while keeping the callback outside iframe config. */
export function requestMagicWidgetCustomMentionSearch(
	context: MagicWidgetEmbedContext | null,
	query: string,
	scope: SearchScope,
	signal: AbortSignal,
): Promise<MagicWidget.CustomMentionSearchResult[]> {
	if (!context || window.parent === window) return Promise.resolve([])

	const requestId = createRequestId()
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handleMessage)
			signal.removeEventListener("abort", handleAbort)
		}
		const handleAbort = () => {
			cleanup()
			window.parent.postMessage(
				{
					protocol: MAGIC_WIDGET_PROTOCOL,
					version: MAGIC_WIDGET_PROTOCOL_VERSION,
					instanceId: context.instanceId,
					requestId,
					type: "mention_search_cancel",
				},
				context.hostOrigin,
			)
			reject(new DOMException("Custom Mention search was aborted", "AbortError"))
		}
		const handleMessage = (event: MessageEvent) => {
			if (
				event.origin !== context.hostOrigin ||
				event.source !== window.parent ||
				!event.data ||
				event.data.protocol !== MAGIC_WIDGET_PROTOCOL ||
				event.data.version !== MAGIC_WIDGET_PROTOCOL_VERSION ||
				event.data.instanceId !== context.instanceId ||
				event.data.type !== "response" ||
				event.data.requestId !== requestId
			) {
				return
			}
			cleanup()
			if (!event.data.ok) {
				reject(new Error(event.data.error?.message ?? "Custom Mention search failed"))
				return
			}
			const results = event.data.result?.customMentionSearch
			if (!Array.isArray(results)) {
				reject(new Error("Custom Mention search returned an invalid result"))
				return
			}
			resolve(results as MagicWidget.CustomMentionSearchResult[])
		}

		if (signal.aborted) {
			handleAbort()
			return
		}
		window.addEventListener("message", handleMessage)
		signal.addEventListener("abort", handleAbort, { once: true })
		window.parent.postMessage(
			{
				protocol: MAGIC_WIDGET_PROTOCOL,
				version: MAGIC_WIDGET_PROTOCOL_VERSION,
				instanceId: context.instanceId,
				requestId,
				type: "mention_search",
				query,
				scope,
			},
			context.hostOrigin,
		)
	})
}
