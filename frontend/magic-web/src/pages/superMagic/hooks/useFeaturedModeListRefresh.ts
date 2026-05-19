import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { reaction } from "mobx"
import type { ModeItem } from "@/pages/superMagic/pages/Workspace/types"
import { configStore } from "@/models/config"
import { userStore } from "@/models/user"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"

/** Featured list is slow-changing; avoid redundant requests on tab churn */
const DEFAULT_VISIBLE_REFRESH_MIN_INTERVAL_MS = 15 * 60 * 1000

/**
 * Imperative refresh after mutations (e.g. crew sort save). Keeps current list until
 * the response replaces it.
 */
export function refreshFeaturedModeList(): Promise<ModeItem[]> {
	return superMagicModeService.fetchModeList({ force: true })
}

function refreshFeaturedModeListFireAndForget() {
	void refreshFeaturedModeList().catch(() => undefined)
}

function canRefreshFeaturedForCurrentUser() {
	return Boolean(userStore.user.organizationCode && userStore.user.userInfo?.user_id)
}

export interface UseFeaturedModeListRefreshOnDocumentVisibleOptions {
	/** Throttle for tab visibility / bfcache (default 15 min) */
	minIntervalMs?: number
}

/**
 * Force-refresh featured list when the tab becomes visible again (hidden→visible) or
 * when the page is restored from bfcache (pageshow persisted). Throttled by default
 * because featured data rarely changes server-side. Skips window focus to avoid spam.
 */
export function useFeaturedModeListRefreshOnDocumentVisible(
	options: UseFeaturedModeListRefreshOnDocumentVisibleOptions = {},
) {
	const minIntervalMs = options.minIntervalMs ?? DEFAULT_VISIBLE_REFRESH_MIN_INTERVAL_MS
	const lastRefreshAtRef = useRef(0)
	const wasHiddenRef = useRef(
		typeof document !== "undefined" && document.visibilityState === "hidden",
	)

	useEffect(() => {
		const tryRefresh = () => {
			if (!canRefreshFeaturedForCurrentUser()) return
			const now = Date.now()
			if (now - lastRefreshAtRef.current < minIntervalMs) return
			lastRefreshAtRef.current = now
			refreshFeaturedModeListFireAndForget()
		}

		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				wasHiddenRef.current = true
				return
			}
			if (document.visibilityState !== "visible") return
			if (!wasHiddenRef.current) return
			wasHiddenRef.current = false
			tryRefresh()
		}

		const onPageShow = (event: PageTransitionEvent) => {
			if (!event.persisted) return
			tryRefresh()
		}

		document.addEventListener("visibilitychange", onVisibilityChange)
		window.addEventListener("pageshow", onPageShow)
		return () => {
			document.removeEventListener("visibilitychange", onVisibilityChange)
			window.removeEventListener("pageshow", onPageShow)
		}
	}, [minIntervalMs])
}

/**
 * After navigation, force-refresh featured crew list on the first time `open` becomes
 * true. Later opens on the same route skip the request; existing list stays until
 * the response replaces it.
 */
export function useFeaturedModeListRefreshOnFirstOpen(open: boolean) {
	const location = useLocation()
	const featuredFetchedOnOpenRef = useRef(false)

	useEffect(() => {
		featuredFetchedOnOpenRef.current = false
	}, [location.pathname, location.search, location.key])

	useEffect(() => {
		if (!open) return
		if (featuredFetchedOnOpenRef.current) return
		featuredFetchedOnOpenRef.current = true
		refreshFeaturedModeListFireAndForget()
	}, [open])
}

/**
 * Agents home: one shot on mount. If list already exists (cache / prior init), force
 * refresh; otherwise initial fetch without bypassing dedupe rules.
 */
export function useFeaturedModeListRefreshOnAgentsPageMount() {
	useEffect(() => {
		if (superMagicModeService.fetchPromise) return

		if (superMagicModeService.modeList.length > 0) {
			refreshFeaturedModeListFireAndForget()
			return
		}

		superMagicModeService.fetchModeList()
	}, [])
}

function isDefaultModeContextReady() {
	const { organizationCode, userInfo } = userStore.user
	return Boolean(organizationCode && userInfo?.user_id && configStore.i18n.displayLanguage)
}

/**
 * Prefetch default-mode model list once on page mount.
 *
 * On hard refresh the component may mount before user/i18n identity is hydrated,
 * producing a request with an `unknown-*` context key that is later discarded by
 * the service's stale-response guard. We fire immediately when ready, otherwise
 * subscribe via MobX `reaction` and retry exactly once when identity arrives.
 */
export function useDefaultModeModelListRefreshOnMount() {
	useEffect(() => {
		const fireForceRefresh = () => {
			void superMagicModeService.fetchDefaultModeModelList({ force: true })
		}

		if (isDefaultModeContextReady()) {
			fireForceRefresh()
			return
		}

		const dispose = reaction(
			() => isDefaultModeContextReady(),
			(ready, _prev, r) => {
				if (!ready) return
				r.dispose()
				fireForceRefresh()
			},
		)
		return dispose
	}, [])
}
