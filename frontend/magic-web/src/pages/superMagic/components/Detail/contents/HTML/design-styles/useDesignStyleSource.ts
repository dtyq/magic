import { useCallback, useEffect, useState } from "react"
import { HtmlDesignStylesApi } from "@/apis"
export interface DesignStyleSourceState {
	content: string
	sha256: string
}

export type DesignStyleSourceStatus = "idle" | "loading" | "success" | "error"

interface CacheEntry {
	state: DesignStyleSourceState
}

const sourceCache = new Map<string, CacheEntry>()
const pendingRequests = new Map<string, Promise<DesignStyleSourceState>>()

/** Clears the module-level cache. Intended for tests. */
export function clearDesignStyleSourceCache() {
	sourceCache.clear()
	pendingRequests.clear()
}

function fetchSource(styleCode: string): Promise<DesignStyleSourceState> {
	const cached = sourceCache.get(styleCode)
	if (cached) return Promise.resolve(cached.state)

	const pending = pendingRequests.get(styleCode)
	if (pending) return pending

	const request = HtmlDesignStylesApi.getSource({ styleCode })
		.then((response) => {
			if (response.style_code && response.style_code !== styleCode) {
				throw new Error(
					`Design style source mismatch: requested ${styleCode}, received ${response.style_code}`,
				)
			}
			const state: DesignStyleSourceState = {
				content: response.content ?? "",
				sha256: response.sha256 ?? "",
			}
			sourceCache.set(styleCode, { state })
			return state
		})
		.finally(() => {
			pendingRequests.delete(styleCode)
		})

	pendingRequests.set(styleCode, request)
	return request
}

export function useDesignStyleSource(styleCode: string, enabled: boolean) {
	const [status, setStatus] = useState<DesignStyleSourceStatus>("idle")
	const [source, setSource] = useState<DesignStyleSourceState | null>(null)
	const [retryToken, setRetryToken] = useState(0)

	useEffect(() => {
		if (!enabled || !styleCode) {
			setStatus("idle")
			setSource(null)
			return
		}

		const cached = sourceCache.get(styleCode)
		if (cached) {
			setSource(cached.state)
			setStatus("success")
			return
		}

		setStatus("loading")
		let cancelled = false

		fetchSource(styleCode)
			.then((state) => {
				if (cancelled) return
				setSource(state)
				setStatus("success")
			})
			.catch(() => {
				if (cancelled) return
				setSource(null)
				setStatus("error")
			})

		return () => {
			// Let superseded requests populate their own cache without updating the current view.
			cancelled = true
		}
	}, [enabled, retryToken, styleCode])

	const retry = useCallback(() => {
		if (styleCode) sourceCache.delete(styleCode)
		setRetryToken((token) => token + 1)
	}, [styleCode])

	return { status, source, retry }
}
