import { useCallback, useEffect, useRef, useState } from "react"
import { autorun } from "mobx"
import type { SelfMediaPlatform } from "../../../types"
import type { SelfMediaPost, SelfMediaPostEntry } from "../types"
import type { AttachmentNode } from "../services"
import { SelfMediaStore, useOptionalSelfMediaStore } from "../stores"

interface UseSelfMediaPostsArgs {
	folderFileId?: string
	attachments?: AttachmentNode[]
	attachmentList?: AttachmentNode[]
	activePlatform?: SelfMediaPlatform
	activePostIndex?: number
}

interface UseSelfMediaPostsResult {
	posts: SelfMediaPost[]
	postEntries: SelfMediaPostEntry[]
	platforms: SelfMediaPlatform[]
	platform: SelfMediaPlatform | null
	loading: boolean
	rootLoading: boolean
	error: string | null
	folderRelativePath: string
	ensurePostLoaded: (index: number) => Promise<SelfMediaPost | null>
	ensureAllPostsLoaded: () => Promise<SelfMediaPost[]>
}

interface Snapshot {
	posts: SelfMediaPost[]
	postEntries: SelfMediaPostEntry[]
	platforms: SelfMediaPlatform[]
	platform: SelfMediaPlatform | null
	loading: boolean
	rootLoading: boolean
	error: string | null
	folderRelativePath: string
}

/**
 * Thin adapter around `SelfMediaStore`.
 *
 * - If the caller is inside a `<SelfMediaStoreProvider>` (production path),
 *   the hook piggybacks on the ambient store: it simply projects observable
 *   values into React state for non-observer consumers.
 *
 * - If there is no ambient store (legacy tests and standalone callers),
 *   a local per-hook store is instantiated and disposed on unmount.
 *
 * The returned shape matches the original hook API so upstream consumers
 * stay unaware of the MobX migration.
 */
export function useSelfMediaPosts({
	folderFileId,
	attachments,
	attachmentList,
	activePlatform,
	activePostIndex = 0,
}: UseSelfMediaPostsArgs): UseSelfMediaPostsResult {
	const ambient = useOptionalSelfMediaStore()
	const localStoreRef = useRef<SelfMediaStore | null>(null)
	if (!ambient && !localStoreRef.current) {
		localStoreRef.current = new SelfMediaStore()
	}
	const store = ambient ?? (localStoreRef.current as SelfMediaStore)
	const isLocalStore = !ambient
	const syncTree = attachments ?? attachmentList

	// Ambient store is driven by the Provider; only the local fallback
	// needs the hook-level effects to mirror args into the store.
	useEffect(() => {
		if (!isLocalStore) return
		void store.sync({ folderFileId, attachments: syncTree })
	}, [isLocalStore, store, folderFileId, syncTree])

	useEffect(() => {
		if (!isLocalStore) return
		store.setActivePlatform(activePlatform)
	}, [isLocalStore, store, activePlatform])

	useEffect(() => {
		if (!isLocalStore) return
		store.setActivePostIndex(activePostIndex)
	}, [isLocalStore, store, activePostIndex])

	useEffect(() => {
		return () => {
			if (isLocalStore) {
				localStoreRef.current?.dispose()
			}
		}
	}, [isLocalStore])

	const [snapshot, setSnapshot] = useState<Snapshot>(() => readSnapshot(store))

	useEffect(() => {
		const disposer = autorun(() => {
			const next = readSnapshot(store)
			setSnapshot((prev) => (snapshotEqual(prev, next) ? prev : next))
		})
		return disposer
	}, [store])

	const ensurePostLoaded = useCallback((index: number) => store.ensurePostLoaded(index), [store])
	const ensureAllPostsLoaded = useCallback(() => store.ensureAllPostsLoaded(), [store])

	return {
		...snapshot,
		ensurePostLoaded,
		ensureAllPostsLoaded,
	}
}

function readSnapshot(store: SelfMediaStore): Snapshot {
	return {
		posts: store.posts,
		postEntries: store.postEntries,
		platforms: store.platforms,
		platform: store.resolvedPlatform,
		loading: store.loading,
		rootLoading: store.rootLoading,
		error: store.error,
		folderRelativePath: store.folderRelativePath,
	}
}

function snapshotEqual(a: Snapshot, b: Snapshot): boolean {
	return (
		a.posts === b.posts &&
		a.postEntries === b.postEntries &&
		a.platforms === b.platforms &&
		a.platform === b.platform &&
		a.loading === b.loading &&
		a.rootLoading === b.rootLoading &&
		a.error === b.error &&
		a.folderRelativePath === b.folderRelativePath
	)
}
