import { useEffect, useMemo, useState, type PropsWithChildren } from "react"
import { useLocation } from "react-router-dom"
import { flushSync } from "react-dom"
import {
	getMagicWidgetEmbedContext,
	getMagicWidgetInitialConfig,
	MAGIC_WIDGET_DISMISS_PREVIEW_EVENT,
	MAGIC_WIDGET_PROTOCOL,
	MAGIC_WIDGET_PROTOCOL_VERSION,
	acceptMagicWidgetConfig,
} from "./config"
import type {
	MagicWidgetConfigWarning,
	MagicWidgetContextValue,
	MagicWidgetEmbedContext,
} from "./types"
import { MagicWidgetContextProvider } from "./context"
import { requestMagicWidgetCustomMentionSearch } from "./mention-search"

export { useMagicWidgetConfig } from "./context"

/** Owns one document-scoped embed identity and revalidates custom Mention groups at the iframe boundary. */
export function MagicWidgetProvider({ children }: PropsWithChildren) {
	const { search } = useLocation()
	// Protected embed metadata is immutable for one iframe document and is re-read after reload.
	const [embedContext] = useState(() => getMagicWidgetEmbedContext(search))
	const [config, setConfig] = useState(() => getMagicWidgetInitialConfig(search, embedContext))

	useEffect(() => {
		if (!embedContext || window.parent === window) return
		const targetOrigin = embedContext.hostOrigin

		/** Returns one correlated configuration result to the bound SDK instance. */
		const respond = (
			context: MagicWidgetEmbedContext,
			requestId: string,
			ok: boolean,
			error?: string,
			configWarning?: MagicWidgetConfigWarning,
		) => {
			window.parent.postMessage(
				{
					protocol: MAGIC_WIDGET_PROTOCOL,
					version: MAGIC_WIDGET_PROTOCOL_VERSION,
					instanceId: context.instanceId,
					requestId,
					type: "response",
					ok,
					result: configWarning ? { configWarning } : undefined,
					error: error ? { code: "INVALID_CONFIG", message: error } : undefined,
				},
				targetOrigin,
			)
		}

		/** Accepts internal commands and configuration only from the bound parent SDK instance. */
		const handleMessage = (event: MessageEvent) => {
			if (
				event.origin !== targetOrigin ||
				event.source !== window.parent ||
				!event.data ||
				event.data.protocol !== MAGIC_WIDGET_PROTOCOL ||
				event.data.version !== MAGIC_WIDGET_PROTOCOL_VERSION ||
				event.data.instanceId !== embedContext.instanceId
			) {
				return
			}

			if (event.data.type === "ui_command" && event.data.command === "dismiss_preview") {
				window.dispatchEvent(new Event(MAGIC_WIDGET_DISMISS_PREVIEW_EVENT))
				return
			}

			if (event.data.type !== "config" || typeof event.data.requestId !== "string") return

			try {
				let configWarning: MagicWidgetConfigWarning | undefined
				const nextConfig = acceptMagicWidgetConfig(event.data.config, (warning) => {
					configWarning = warning
				})
				// Commit the new snapshot before acknowledging it so updateConfig resolves after UI state changes.
				flushSync(() => setConfig(nextConfig))
				respond(embedContext, event.data.requestId, true, undefined, configWarning)
			} catch (error) {
				respond(
					embedContext,
					event.data.requestId,
					false,
					error instanceof Error ? error.message : "Widget configuration is invalid",
				)
			}
		}

		window.addEventListener("message", handleMessage)
		// Announce only after the validated listener is installed so reload synchronization cannot race it.
		window.parent.postMessage(
			{
				protocol: MAGIC_WIDGET_PROTOCOL,
				version: MAGIC_WIDGET_PROTOCOL_VERSION,
				instanceId: embedContext.instanceId,
				type: "config_ready",
			},
			targetOrigin,
		)
		return () => window.removeEventListener("message", handleMessage)
	}, [embedContext])

	const value = useMemo<MagicWidgetContextValue>(
		() => ({
			embedContext,
			config,
			requestCustomMentionSearch: (query, scope, signal) =>
				requestMagicWidgetCustomMentionSearch(embedContext, query, scope, signal),
		}),
		[config, embedContext],
	)
	return <MagicWidgetContextProvider value={value}>{children}</MagicWidgetContextProvider>
}
