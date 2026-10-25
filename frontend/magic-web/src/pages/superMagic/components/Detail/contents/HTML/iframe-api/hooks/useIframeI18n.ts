import { useEffect, type RefObject } from "react"
import { useMemoizedFn } from "ahooks"
import type { i18n } from "i18next"
import { normalizeLocale } from "@/utils/locale"

/** Keep the document's language snapshot live without replacing its Window or state. */
export function useIframeI18n({
	iframeRef,
	targetOrigin,
	i18n,
	enabled = true,
}: {
	iframeRef: RefObject<HTMLIFrameElement>
	targetOrigin: string
	i18n: Pick<i18n, "language" | "resolvedLanguage" | "on" | "off">
	enabled?: boolean
}) {
	const notify = useMemoizedFn(
		(source: "subscribe_ack" | "language_changed", requestId?: string, language?: string) => {
			if (!enabled) return
			iframeRef.current?.contentWindow?.postMessage(
				{
					type: "MAGIC_I18N_LANG_SUBSCRIBE",
					requestId,
					success: true,
					results: {
						lang: normalizeLocale(language || i18n.resolvedLanguage || i18n.language),
						source,
					},
				},
				targetOrigin,
			)
		},
	)
	useEffect(() => {
		if (!enabled) return
		// lang is readable without subscribe; callbacks are managed inside the child.
		// Do not gate updates on a host flag that can be cleared by deduplicated injection.
		const changed = (language: string) => notify("language_changed", undefined, language)
		i18n.on("languageChanged", changed)
		return () => {
			i18n.off("languageChanged", changed)
		}
	}, [enabled, i18n, notify])
	return notify
}
