import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import SelfMediaPostPublishedLinkPopover from "../components/SelfMediaPostPublishedLinkPopover"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) =>
			({
				"detail.selfMedia.home.bindPublishedLink": "Add link",
				"detail.selfMedia.home.editPublishedLink": "Edit link",
				"detail.selfMedia.home.publishedLinkInput": "Published content link",
				"detail.selfMedia.home.publishedLinkPlaceholder": "Paste the link",
				"detail.selfMedia.home.loadingPublishedLink": "Loading link...",
				"detail.selfMedia.home.bindPublishedLinkAction": "Save link",
				"detail.selfMedia.home.bindAndFetchPublishedData": "Save and fetch",
			})[key] || key,
	}),
}))

vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => true,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		visible,
		children,
		headerTitle,
	}: {
		visible?: boolean
		children?: ReactNode
		headerTitle?: ReactNode
	}) =>
		visible ? (
			<div data-testid="mock-mobile-popup">
				<h2>{headerTitle}</h2>
				{children}
			</div>
		) : null,
}))

function createPostItem(): SelfMediaPlatformPostItem {
	return {
		platform: "rednote",
		index: 0,
		entry: {
			id: "post-1",
			name: "Post One",
			entry: "posts/post-1/post.json",
		},
		post: {
			meta: {
				id: "post-1",
				title: "Post One",
			},
			cards: [],
		},
	}
}

describe("SelfMediaPostPublishedLinkPopover mobile", () => {
	it("opens the published link form in a bottom popup on mobile", () => {
		render(
			<SelfMediaPostPublishedLinkPopover
				item={createPostItem()}
				postId="post-1"
				sourceReady={false}
				trigger="action"
				showLabel
				localPublishedUrl=""
				onLocalPublishedUrlChange={vi.fn()}
				onBindPublishedUrl={vi.fn()}
				onLoadPublishedUrl={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-post-1"))

		expect(
			screen.getByTestId("self-media-home-post-bind-link-sheet-post-1"),
		).toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-bind-link-popover-post-1"),
		).not.toBeInTheDocument()
		expect(
			screen.getByTestId("self-media-home-post-bind-link-input-post-1"),
		).toBeInTheDocument()
		expect(screen.getByTestId("mock-mobile-popup")).toHaveTextContent("Add link")
	})
})
