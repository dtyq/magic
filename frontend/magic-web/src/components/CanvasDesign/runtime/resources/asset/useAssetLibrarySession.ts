import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useSharedMediaResourceScope } from "@/pages/superMagic/services/sharedMediaResourceScope"
import {
	assetLibrarySessionStore,
	type AssetLibraryQuery,
	type AssetLibraryQuerySnapshot,
} from "./AssetLibrarySessionStore"
import type { AssetOwnerItem } from "@/apis"

const EMPTY_OWNERS: AssetOwnerItem[] = []

export function useAssetLibrarySession(query: AssetLibraryQuery, enabled: boolean) {
	const scope = useSharedMediaResourceScope()
	const queryKey = useMemo(
		() => assetLibrarySessionStore.getQueryKey(query, scope),
		[query, scope],
	)
	const getSnapshot = useCallback<() => AssetLibraryQuerySnapshot>(
		() => assetLibrarySessionStore.getSnapshotByKey(queryKey, scope),
		[queryKey, scope],
	)
	const snapshot = useSyncExternalStore(
		assetLibrarySessionStore.subscribe,
		getSnapshot,
		getSnapshot,
	)
	const [owners, setOwners] = useState(EMPTY_OWNERS)

	useEffect(() => {
		setOwners(assetLibrarySessionStore.getCachedOwners(scope) ?? EMPTY_OWNERS)
		if (!enabled) return
		let active = true
		void assetLibrarySessionStore
			.getOwners(scope)
			.then((nextOwners) => {
				if (active) setOwners(nextOwners)
			})
			.catch(() => undefined)
		return () => {
			active = false
		}
	}, [enabled, scope])

	useEffect(() => {
		if (!enabled) return
		return assetLibrarySessionStore.subscribe(() => {
			setOwners(assetLibrarySessionStore.getCachedOwners(scope) ?? EMPTY_OWNERS)
		})
	}, [enabled, scope])

	useEffect(() => {
		if (!enabled) return
		// Keep the existing picker behavior: keyword changes settle briefly before
		// issuing a request, while cached snapshots remain visible immediately.
		const timer = window.setTimeout(
			() => void assetLibrarySessionStore.queryAssets(query, scope).catch(() => undefined),
			snapshot.stale ? 0 : 250,
		)
		return () => window.clearTimeout(timer)
	}, [enabled, query, queryKey, scope, snapshot.revision, snapshot.stale])

	const refreshAssets = useCallback(
		() => assetLibrarySessionStore.refreshAssets(query, scope),
		[query, scope],
	)

	return {
		assets: snapshot.assets,
		owners,
		loading: snapshot.loading,
		refreshing: snapshot.refreshing,
		error: snapshot.error,
		refreshAssets,
	}
}
