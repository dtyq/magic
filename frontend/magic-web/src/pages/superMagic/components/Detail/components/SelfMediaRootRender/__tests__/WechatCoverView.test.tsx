import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import WechatCoverView from "../platforms/wechat-official-accounts/cover"
import type { SelfMediaPost } from "../types"

const translationMap: Record<string, string> = {
	"detail.selfMedia.common.unknownAuthor": "Unknown author",
	"detail.selfMedia.common.untitledPost": "Untitled post",
	"detail.selfMedia.platform.wechat-official-accounts.cover.timeHint": "Just now",
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

vi.mock("../platforms/wechat-official-accounts/useCoverImageUrl", () => ({
	useCoverImageUrl: () => ({
		url: null,
		loading: false,
	}),
}))

type ObserverEntry = {
	callback: IntersectionObserverCallback
	elements: Set<Element>
}

const observerEntries: ObserverEntry[] = []

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void
	let reject!: (reason?: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

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
	observerEntries.length = 0
})

describe("WechatCoverView", () => {
	it("renders placeholder text instead of question marks for missing cover meta", () => {
		render(
			<WechatCoverView
				posts={[
					{
						meta: {
							id: "post-1",
						},
						cards: [],
					},
				]}
				onSelectPost={vi.fn()}
			/>,
		)

		expect(screen.getByText("Unknown author")).toBeInTheDocument()
		expect(screen.getByText("Untitled post")).toBeInTheDocument()
		expect(screen.queryByText("?")).not.toBeInTheDocument()
	})

	it("shows post loading skeleton while the cover post request is pending", async () => {
		const deferred = createDeferred<SelfMediaPost | null>()
		const onEnsurePostLoaded = vi.fn(() => deferred.promise)

		render(
			<WechatCoverView
				posts={[
					{
						meta: {
							id: "post-1",
							title: "First post",
							feedTitle: "First feed title",
							author: "@magic",
						},
						cards: [],
					},
				]}
				onSelectPost={vi.fn()}
				onEnsurePostLoaded={onEnsurePostLoaded}
			/>,
		)

		const card = screen.getByTestId("wechat-cover-card-post-1")
		act(() => {
			triggerIntersection(card, true)
		})

		await waitFor(() => {
			expect(onEnsurePostLoaded).toHaveBeenCalledWith(0)
			expect(screen.getByTestId("wechat-cover-post-loading-post-1")).toBeInTheDocument()
		})

		act(() => {
			deferred.resolve({
				meta: {
					id: "post-1",
					title: "First post",
					feedTitle: "First feed title",
					author: "@magic",
				},
				cards: [],
				heroCover: { path: "covers/hero.png", fileId: "hero-1" },
			})
		})

		await waitFor(() => {
			expect(screen.queryByTestId("wechat-cover-post-loading-post-1")).not.toBeInTheDocument()
		})
	})
})
