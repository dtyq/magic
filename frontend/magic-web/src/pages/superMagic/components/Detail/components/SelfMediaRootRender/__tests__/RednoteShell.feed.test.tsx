import { forwardRef, useEffect } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { runInAction } from "mobx"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import RednoteShell from "../platforms/rednote/RednoteShell"
import { cacheKey } from "../services"
import type { SelfMediaAttachmentNode, SelfMediaPost } from "../types"
import { createFakeService, createTestStore, wrapWithStore } from "./testStoreHelpers"
import type { SelfMediaPostsService } from "../services"

vi.mock("@/pages/superMagic/utils/topics", () => ({
	addFileToCurrentChat: vi.fn(),
	addFileToNewChat: vi.fn(),
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: {
		selectedWorkspace: { id: "workspace-1" },
	},
	projectStore: {
		selectedProject: { id: "project-1" },
	},
}))

const translationMap: Record<string, string> = {
	"detail.selfMedia.common.unknownAuthor": "Unknown author",
	"detail.selfMedia.common.untitledPost": "Untitled post",
}

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => translationMap[key] || key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
}))

vi.mock("../platforms/rednote/edit", () => ({
	__esModule: true,
	default: () => <div data-testid="mock-red-edit" />,
}))

const cardFrameMountCounts = new Map<string, number>()

vi.mock("../components/CardFrame", () => ({
	__esModule: true,
	default: forwardRef(function MockCardFrame(
		{
			cardId,
			className,
			autoHeight,
		}: {
			cardId: string
			className?: string
			autoHeight?: boolean
		},
		ref,
	) {
		void ref
		useEffect(() => {
			cardFrameMountCounts.set(cardId, (cardFrameMountCounts.get(cardId) || 0) + 1)
		}, [cardId])

		return (
			<div
				data-testid="self-media-cardframe"
				data-card-id={cardId}
				data-auto-height={String(autoHeight)}
				className={className}
			/>
		)
	}),
}))

vi.mock("../components/PhoneShell", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="self-media-phone-shell">{children}</div>
	),
}))

vi.mock("../components/ExportPanel", () => ({
	__esModule: true,
	default: () => <button type="button" data-testid="self-media-export-panel" />,
}))

vi.mock("../components/ExportPreviewDialog", () => ({
	__esModule: true,
	default: () => null,
}))

vi.mock("../components/PostSelector", () => ({
	__esModule: true,
	default: () => <div data-testid="self-media-platform-selector" />,
}))

vi.mock("../components/ViewTabs", () => ({
	__esModule: true,
	default: () => <div data-testid="self-media-view-tabs" />,
}))

vi.mock("../hooks/useExportZip", () => ({
	useExportZip: () => ({
		progress: { current: 0, total: 0, status: "idle" },
		exportZip: vi.fn(),
	}),
}))

vi.mock("../hooks/usePhoneScaling", () => ({
	usePhoneScaling: () => ({
		containerRef: { current: null },
		scale: 1,
		width: 375,
		height: 812,
	}),
}))

type ObserverEntry = {
	callback: IntersectionObserverCallback
	elements: Set<Element>
}

const observerEntries: ObserverEntry[] = []

beforeAll(() => {
	class MockIntersectionObserver {
		private readonly callback: IntersectionObserverCallback
		private readonly elements = new Set<Element>()

		constructor(callback: IntersectionObserverCallback) {
			this.callback = callback
			observerEntries.push({
				callback,
				elements: this.elements,
			})
		}

		observe = (element: Element) => {
			this.elements.add(element)
		}

		unobserve = (element: Element) => {
			this.elements.delete(element)
		}

		disconnect = () => {
			this.elements.clear()
		}

		takeRecords = () => []
	}

	vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)
})

beforeEach(() => {
	cardFrameMountCounts.clear()
	observerEntries.length = 0
})

function triggerIntersection(element: Element, isIntersecting: boolean) {
	const targetObserver = observerEntries.find((entry) => entry.elements.has(element))
	if (!targetObserver) throw new Error("observer not found")

	targetObserver.callback(
		[
			{
				target: element,
				isIntersecting,
				intersectionRatio: isIntersecting ? 1 : 0,
				boundingClientRect: element.getBoundingClientRect(),
				intersectionRect: element.getBoundingClientRect(),
				rootBounds: null,
				time: Date.now(),
			} as IntersectionObserverEntry,
		],
		{} as IntersectionObserver,
	)
}

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

const DEFAULT_POSTS: SelfMediaPost[] = [
	{
		meta: {
			id: "post-1",
			title: "First post",
			feedTitle: "First feed title",
			author: "@magic",
			feedLikes: "12",
		},
		cards: [{ path: "cards/01.html", fileId: "card-1" }],
	},
	{
		meta: {
			id: "post-2",
			title: "Second post",
			feedTitle: "Second feed title",
			author: "@magic-2",
			feedLikes: "99",
		},
		cards: [{ path: "cards/02.html", fileId: "card-2" }],
	},
]

function renderShell(
	args: {
		posts?: SelfMediaPost[]
		attachmentList?: SelfMediaAttachmentNode[]
		service?: SelfMediaPostsService
		postsUncached?: boolean
	} = {},
) {
	const service = args.service ?? createFakeService()
	const store = createTestStore(
		{
			platform: "rednote",
			posts: args.posts ?? DEFAULT_POSTS,
			view: "feed",
			postsUncached: args.postsUncached,
		},
		service,
	)
	render(
		wrapWithStore(
			store,
			<RednoteShell platform="rednote" attachmentList={args.attachmentList ?? []} />,
		),
	)
	return { store, service }
}

describe("RednoteShell feed", () => {
	it("renders the in-phone feed header and masonry layout", () => {
		renderShell()

		expect(screen.getByTestId("red-feed-header")).toBeInTheDocument()
		expect(screen.getByTestId("red-feed-header-discover-tab")).toBeInTheDocument()
		expect(screen.getByTestId("red-feed-header-search-button")).toBeInTheDocument()
		expect(screen.getByTestId("red-feed-view").className).toContain("overflow-y-auto")

		const masonry = screen.getByTestId("red-feed-view").querySelector(".columns-2")
		expect(masonry).toBeTruthy()
	})

	it("renders placeholder text instead of question marks for missing feed meta", () => {
		renderShell({
			posts: [
				{
					meta: {
						id: "post-1",
					},
					cards: [{ path: "cards/01.html", fileId: "card-1" }],
				},
			],
		})

		expect(screen.getByText("Unknown author")).toBeInTheDocument()
		expect(screen.getByText("Untitled post")).toBeInTheDocument()
		expect(screen.queryByText("?")).not.toBeInTheDocument()
	})

	it("lazy loads the first cover card when a feed card enters the viewport", async () => {
		renderShell()

		expect(cardFrameMountCounts.get("red-feed-cover-post-1-0")).toBeUndefined()
		expect(cardFrameMountCounts.get("red-feed-cover-post-2-0")).toBeUndefined()

		const firstSlot = screen.getByTestId("red-feed-cover-slot-post-1")
		act(() => {
			triggerIntersection(firstSlot, true)
		})

		await waitFor(() => {
			expect(cardFrameMountCounts.get("red-feed-cover-post-1-0")).toBe(1)
		})
		expect(cardFrameMountCounts.get("red-feed-cover-post-2-0")).toBeUndefined()

		const secondSlot = screen.getByTestId("red-feed-cover-slot-post-2")
		act(() => {
			triggerIntersection(secondSlot, true)
		})

		await waitFor(() => {
			expect(cardFrameMountCounts.get("red-feed-cover-post-2-0")).toBe(1)
		})
	})

	it("requests post loading when a visible feed card has no cover fileId", async () => {
		const service = createFakeService()
		renderShell({
			service,
			postsUncached: true,
			posts: [
				{
					meta: {
						id: "post-1",
						title: "First post",
						feedTitle: "First feed title",
						author: "@magic",
						feedLikes: "12",
					},
					cards: [{ path: "cards/01.html" }],
				},
			],
		})

		const firstSlot = await screen.findByTestId("red-feed-cover-slot-post-1")
		act(() => {
			triggerIntersection(firstSlot, true)
		})

		await waitFor(() => {
			expect(service.ensurePostLoaded).toHaveBeenCalledWith(
				expect.objectContaining({
					entry: expect.objectContaining({ id: "post-1" }),
				}),
			)
		})
		expect(cardFrameMountCounts.get("red-feed-cover-post-1-0")).toBeUndefined()
	})

	it("shows post loading skeleton while the feed post request is pending", async () => {
		const service = createFakeService()
		const deferred = createDeferred<SelfMediaPost>()
		vi.mocked(service.ensurePostLoaded).mockReturnValueOnce(deferred.promise)
		const posts: SelfMediaPost[] = [
			{
				meta: {
					id: "post-1",
					title: "First post",
					feedTitle: "First feed title",
					author: "@magic",
					feedLikes: "12",
				},
				cards: [{ path: "cards/01.html", fileId: "card-1" }],
			},
			{
				meta: {
					id: "post-2",
					title: "Second post",
					feedTitle: "Second feed title",
					author: "@magic-2",
					feedLikes: "34",
				},
				cards: [{ path: "cards/02.html" }],
			},
		]
		const store = createTestStore({ platform: "rednote", posts, view: "feed" }, service)
		runInAction(() => {
			store.loadedPosts = {
				[cacheKey("rednote", "post-1")]: posts[0],
			}
			store.activePostIndex = 0
		})

		render(wrapWithStore(store, <RednoteShell platform="rednote" attachmentList={[]} />))

		const secondSlot = await screen.findByTestId("red-feed-cover-slot-post-2")
		act(() => {
			triggerIntersection(secondSlot, true)
		})

		await waitFor(() => {
			expect(screen.getByTestId("red-feed-post-loading-post-2")).toBeInTheDocument()
		})

		act(() => {
			deferred.resolve({
				meta: {
					id: "post-2",
					title: "Second post",
					feedTitle: "Second feed title",
					author: "@magic-2",
					feedLikes: "34",
				},
				cards: [{ path: "cards/02.html", fileId: "card-2" }],
			})
		})

		await waitFor(() => {
			expect(screen.queryByTestId("red-feed-post-loading-post-2")).not.toBeInTheDocument()
		})
	})
})
