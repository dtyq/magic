import type { ReactNode } from "react"
import { runInAction } from "mobx"
import { vi } from "vitest"
import { SelfMediaPlatformChromeProvider } from "../context/PlatformChromeContext"
import { SelfMediaStore, SelfMediaStoreProvider } from "../stores"
import type { SelfMediaPlatform } from "../../../types"
import type { SelfMediaPost, SelfMediaPostEntry, SelfMediaView } from "../types"
import type { PlatformSlice, SelfMediaPostsService } from "../services"
import { cacheKey } from "../services"

/**
 * Minimal stand-in for `SelfMediaPostsService` usable in tests. Only the
 * methods actually touched by the store lifecycle / adapters need to be
 * provided; everything else is a vi.fn() stub.
 */
export function createFakeService(): SelfMediaPostsService {
	const svc = {
		initialize: vi.fn(async () => ({
			slices: [] as PlatformSlice[],
			loadedPosts: {} as Record<string, SelfMediaPost>,
			error: null as string | null,
			folderRelativePath: "/",
		})),
		reconcile: vi.fn(async () => ({
			slices: [] as PlatformSlice[],
			loadedPosts: {} as Record<string, SelfMediaPost>,
			error: null as string | null,
			folderRelativePath: "/",
		})),
		ensurePostLoaded: vi.fn(async (args: { entry: SelfMediaPostEntry }) => ({
			meta: args.entry ? { id: args.entry.id, title: args.entry.name } : { id: "" },
			cards: [],
		})),
		ensureAllPostsLoaded: vi.fn(async () => [] as SelfMediaPost[]),
		resolveTreeContext: vi.fn(() => ({ allFiles: [] as unknown[] })),
		dispose: vi.fn(),
	}
	return svc as unknown as SelfMediaPostsService
}

export interface StoreSeed {
	platform?: SelfMediaPlatform
	posts?: SelfMediaPost[]
	/**
	 * When `true`, posts are exposed only via `postEntries` (shell sees
	 * placeholders) but never inserted into `loadedPosts` — useful to force
	 * `ensurePostLoaded` to go through the underlying service.
	 */
	postsUncached?: boolean
	activePostIndex?: number
	activeCardIndex?: number
	view?: SelfMediaView
	loading?: boolean
	rootLoading?: boolean
	error?: string | null
	folderRelativePath?: string
}

/**
 * Build a `SelfMediaStore` pre-seeded for snapshot-style rendering. Posts
 * supplied here are exposed as loaded posts under the given platform so the
 * store returns them verbatim from its `posts` computed.
 */
export function createTestStore(
	seed: StoreSeed = {},
	service: SelfMediaPostsService = createFakeService(),
): SelfMediaStore {
	const store = new SelfMediaStore(service)
	runInAction(() => {
		const platform = seed.platform ?? "rednote"
		const posts = seed.posts ?? []
		const postEntries: SelfMediaPostEntry[] = posts.map((p, idx) => ({
			id: p.meta.id || `post-${idx}`,
			name: p.meta.title || `Post ${idx}`,
			entry: `posts/${p.meta.id || idx}/post.json`,
		}))
		store.slices = posts.length
			? [
					{
						platform,
						config: { posts: postEntries },
						postEntries,
					} as PlatformSlice,
				]
			: []
		store.loadedPosts = seed.postsUncached
			? {}
			: posts.reduce<Record<string, SelfMediaPost>>((acc, p, idx) => {
					acc[cacheKey(platform, postEntries[idx].id)] = p
					return acc
				}, {})
		store.activePlatform = platform
		store.activePostIndex = seed.activePostIndex ?? 0
		store.activeCardIndex = seed.activeCardIndex ?? 0
		store.view = seed.view ?? "detail"
		store.rootLoading = seed.rootLoading ?? false
		store.loading = seed.loading ?? false
		store.error = seed.error ?? null
		store.folderRelativePath = seed.folderRelativePath ?? "/"
	})
	return store
}

/** Shorthand wrapper: store + platform chrome (portal host for tests). */
export function wrapWithStore(store: SelfMediaStore, children: ReactNode) {
	return (
		<SelfMediaStoreProvider store={store}>
			<SelfMediaPlatformChromeProvider>{children}</SelfMediaPlatformChromeProvider>
		</SelfMediaStoreProvider>
	)
}
