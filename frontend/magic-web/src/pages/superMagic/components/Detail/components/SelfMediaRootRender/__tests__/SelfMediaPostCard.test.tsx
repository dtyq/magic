import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SelfMediaPostCard from "../components/SelfMediaPostCard"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "en" },
		t: (key: string) =>
			({
				"detail.selfMedia.home.dataSyncNow": "Sync",
				"detail.selfMedia.home.autoSync": "Auto sync",
				"detail.selfMedia.home.autoSyncDescription": "Run on a schedule",
				"detail.selfMedia.home.autoSyncStatus": "Status",
				"detail.selfMedia.home.autoSyncEnabled": "On",
				"detail.selfMedia.home.autoSyncDisabled": "Off",
				"detail.selfMedia.home.autoSyncDaily": "Daily",
				"detail.selfMedia.home.autoSyncWeekly": "Weekly",
				"detail.selfMedia.home.autoSyncMonthly": "Monthly",
				"detail.selfMedia.home.autoSyncSave": "Save auto sync",
				"detail.selfMedia.home.autoSyncTurnOff": "Turn off auto sync",
				"detail.selfMedia.home.loadingAutoSync": "Loading auto sync",
				"detail.selfMedia.home.bindPublishedLink": "Add link",
				"detail.selfMedia.home.editPublishedLink": "Edit link",
				"detail.selfMedia.home.publishedLinkInput": "Published content link",
				"detail.selfMedia.home.publishedLinkPlaceholder": "Paste the link",
				"detail.selfMedia.home.loadingPublishedLink": "Loading link...",
				"detail.selfMedia.home.bindPublishedLinkAction": "Save link",
				"detail.selfMedia.home.bindAndFetchPublishedData": "Save and fetch",
				"detail.selfMedia.home.deletePost": "Delete article",
				"detail.selfMedia.home.deletePostCancel": "Cancel",
				"detail.selfMedia.home.deletePostConfirm": "Delete permanently",
				"detail.selfMedia.home.deletePostDescription":
					"This article will be permanently deleted and cannot be restored.",
				"detail.selfMedia.home.deletePostTitle": "Delete this article?",
				"detail.selfMedia.home.archivePost": "Pause publishing",
				"detail.selfMedia.home.restorePostPublish": "Restore to publish",
				"detail.selfMedia.home.renamePost": "Rename article",
				"detail.selfMedia.home.renamePostCancel": "Cancel",
				"detail.selfMedia.home.renamePostConfirm": "Save name",
				"detail.selfMedia.home.renamePostDescription":
					"Update the article name shown on the home page.",
				"detail.selfMedia.home.renamePostFailed": "Failed to rename article.",
				"detail.selfMedia.home.renamePostInput": "Article name",
				"detail.selfMedia.home.renamePostTitle": "Rename article",
				"detail.selfMedia.home.mentionPost": "Mention this article",
				"detail.selfMedia.home.moreActions": "More actions",
				"fileViewer.share": "Share",
				"detail.selfMedia.home.opsArtifacts.sourceReady": "Source ready",
				"detail.selfMedia.home.opsArtifacts.sourceMissing": "Source missing",
				"detail.selfMedia.home.opsArtifacts.metricsReady": "Metrics ready",
				"detail.selfMedia.home.opsArtifacts.metricsMissing": "Metrics missing",
				"detail.selfMedia.home.opsArtifacts.commentsReady": "Comments ready",
				"detail.selfMedia.home.opsArtifacts.commentsMissing": "Comments missing",
				"detail.selfMedia.home.opsArtifacts.reviewReady": "Review ready",
				"detail.selfMedia.home.opsArtifacts.reviewMissing": "Review missing",
				"detail.selfMedia.home.engagement.reads": "Reads",
				"detail.selfMedia.home.engagement.likes": "Likes",
				"detail.selfMedia.home.engagement.comments": "Comments",
				"detail.selfMedia.home.lifecycle.draft": "To publish",
				"detail.selfMedia.home.lifecycle.archived": "Paused",
				"detail.selfMedia.home.lifecycle.published": "Published",
				"detail.selfMedia.home.lifecycle.synced": "Data synced",
				"detail.selfMedia.home.lifecycle.reviewed": "Reviewed",
			})[key] || key,
	}),
}))

vi.mock("@/components/base/MagicTooltip", () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("../components/CardFrame", () => ({
	default: () => <div data-testid="mock-card-frame" />,
}))

vi.mock("../platforms/wechat-official-accounts/useCoverImageUrl", () => ({
	useCoverImageUrl: () => ({ url: "" }),
}))

function createPostItem(
	entryOverrides: Partial<SelfMediaPlatformPostItem["entry"]> = {},
): SelfMediaPlatformPostItem {
	return {
		platform: "rednote",
		index: 0,
		entry: {
			id: "post-1",
			name: "Post One",
			entry: "posts/post-1/post.json",
			...entryOverrides,
		},
		post: {
			meta: {
				id: "post-1",
				title: "Post One",
				feedTitle: "Post One Feed",
			},
			cards: [],
		},
	}
}

function renderCard(props: Partial<React.ComponentProps<typeof SelfMediaPostCard>> = {}) {
	return render(
		<SelfMediaPostCard
			item={createPostItem()}
			title="Post One"
			subtitle="Post subtitle"
			postId="post-1"
			opsArtifacts={{ source: true, metrics: false, comments: false, review: false }}
			onOpenPost={vi.fn()}
			onPostPublishRefresh={vi.fn()}
			onConfigureAutoSync={vi.fn()}
			{...props}
		/>,
	)
}

describe("SelfMediaPostCard", () => {
	it("keeps action labels visible even before the card width is measured", () => {
		renderCard()

		expect(screen.getByTestId("self-media-home-post-card-post-1")).toHaveAttribute(
			"data-card-layout",
			"compact",
		)
		expect(screen.getByTestId("self-media-home-post-open-post-1").className).not.toContain(
			"@md/self-media-card",
		)
		expect(screen.getByTestId("self-media-home-post-actions-post-1")).toHaveAttribute(
			"data-label-mode",
			"expanded",
		)
		expect(screen.getByTestId("self-media-home-post-ops-data-post-1")).toHaveTextContent("Sync")
	})

	it("expands card controls after the card width is measured", async () => {
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: 390,
				bottom: 160,
				width: 390,
				height: 160,
				toJSON: () => ({}),
			})

		renderCard()

		await waitFor(() => {
			expect(screen.getByTestId("self-media-home-post-card-post-1")).toHaveAttribute(
				"data-card-layout",
				"comfortable",
			)
			expect(screen.getByTestId("self-media-home-post-actions-post-1")).toHaveAttribute(
				"data-label-mode",
				"expanded",
			)
			expect(screen.getByTestId("self-media-home-post-actions-post-1")).toHaveClass(
				"flex-wrap",
			)
			expect(
				screen.getByTestId("self-media-home-post-actions-post-1").className,
			).not.toContain("flex-nowrap")
			expect(screen.getByTestId("self-media-home-post-actions-post-1").className).toContain(
				"absolute",
			)
			expect(
				screen.getByTestId("self-media-home-post-actions-post-1").className,
			).not.toContain("max-w-[calc(100%-6rem)]")
		})

		getBoundingClientRect.mockRestore()
	})

	it("limits the title and subtitle copy to two lines", () => {
		renderCard({
			title: "This is a very long article title that should remain readable across two lines",
			subtitle:
				"This is a very long article subtitle that can also use up to two lines before it gets clipped by the card layout.",
		})

		const title = screen.getByText(
			"This is a very long article title that should remain readable across two lines",
		)
		const subtitle = screen.getByText(
			"This is a very long article subtitle that can also use up to two lines before it gets clipped by the card layout.",
		)

		expect(title).toHaveClass("line-clamp-2")
		expect(title.className).not.toContain("truncate")
		expect(subtitle).toHaveClass("line-clamp-2")
	})

	it("stretches the card surface to the grid row height so uneven copy stays aligned", () => {
		renderCard({
			title: "Short title",
			subtitle: "One line subtitle",
		})

		const card = screen.getByTestId("self-media-home-post-card-post-1")
		const surface = screen.getByTestId("self-media-home-post-open-post-1").parentElement

		expect(card).toHaveClass("h-full")
		expect(surface).toHaveClass("h-full")
		expect(surface).toHaveClass("min-h-[168px]")
		expect(surface).toHaveClass("pb-[80px]")
	})

	it("keeps engagement metrics on one line", () => {
		renderCard({
			opsMetrics: {
				version: 1,
				updatedAt: "2026-06-14T10:00:00.000Z",
				source: "real-platform",
				metrics: {
					reads: 12708,
					likes: 130,
					comments: 12,
				},
			},
		})

		const engagement = screen.getByTestId("self-media-home-post-engagement-post-1")

		expect(engagement).toHaveTextContent("Reads 12.7k")
		expect(engagement).toHaveTextContent("Likes 130")
		expect(engagement).toHaveTextContent("Comments 12")
		expect(engagement).toHaveClass("flex-nowrap", "overflow-hidden", "whitespace-nowrap")
		expect(engagement.className).not.toContain("flex-wrap")
		for (const metric of Array.from(engagement.children)) {
			expect(metric).toHaveClass("shrink-0", "whitespace-nowrap")
		}
	})

	it("localizes compact metric units instead of showing Chinese wan in English", () => {
		renderCard({
			opsMetrics: {
				version: 1,
				updatedAt: "2026-06-14T10:00:00.000Z",
				source: "real-platform",
				metrics: {
					likes: "2.6w",
					comments: 312,
				},
			},
		})

		const engagement = screen.getByTestId("self-media-home-post-engagement-post-1")
		expect(engagement).toHaveTextContent("Likes 26k")
		expect(engagement).toHaveTextContent("Comments 312")
		expect(engagement).not.toHaveTextContent("2.6w")
	})

	it("treats loaded ops metrics as published evidence when the source artifact is stale", () => {
		const onLoadPublishedUrl = vi.fn()

		renderCard({
			opsArtifacts: { source: false, metrics: false, comments: false, review: false },
			opsMetrics: {
				version: 1,
				updatedAt: "2026-06-14T10:00:00.000Z",
				source: "real-platform",
				metrics: {
					reads: 4747,
					likes: 30,
					comments: 3,
				},
			},
			onLoadPublishedUrl,
			onBindPublishedUrl: vi.fn(),
		})

		expect(screen.getByTestId("self-media-home-post-engagement-post-1")).toHaveTextContent(
			"Reads 4.7k",
		)
		expect(
			screen.queryByTestId("self-media-home-post-bind-link-post-1"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-post-lifecycle-post-1")).toHaveAttribute(
			"data-lifecycle",
			"synced",
		)
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-source"),
		).toHaveAttribute("data-ready", "true")
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-metrics"),
		).toHaveAttribute("data-ready", "true")
		expect(screen.getByTestId("self-media-home-post-ops-data-post-1")).toBeInTheDocument()
		expect(onLoadPublishedUrl).not.toHaveBeenCalled()
	})

	it("treats review artifacts as published evidence when the source artifact is stale", () => {
		renderCard({
			opsArtifacts: { source: false, metrics: false, comments: false, review: true },
			onBindPublishedUrl: vi.fn(),
			onLoadPublishedUrl: vi.fn(),
		})

		expect(
			screen.queryByTestId("self-media-home-post-bind-link-post-1"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-post-lifecycle-post-1")).toHaveAttribute(
			"data-lifecycle",
			"reviewed",
		)
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-source"),
		).toHaveAttribute("data-ready", "true")
	})

	it("passes the card geometry when opening a post", () => {
		const onOpenPost = vi.fn()
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({
				x: 18,
				y: 92,
				left: 18,
				top: 92,
				right: 338,
				bottom: 252,
				width: 320,
				height: 160,
				toJSON: () => ({}),
			})

		renderCard({ onOpenPost })

		fireEvent.click(screen.getByTestId("self-media-home-post-open-post-1"))

		expect(onOpenPost).toHaveBeenCalledWith(
			{ platform: "rednote", index: 0 },
			expect.objectContaining({
				postId: "post-1",
				title: "Post One",
				subtitle: "Post subtitle",
				rect: { left: 18, top: 92, width: 320, height: 160 },
			}),
		)

		getBoundingClientRect.mockRestore()
	})

	it("surfaces the post lifecycle state near the title", () => {
		const { rerender } = renderCard({
			opsArtifacts: { source: false, metrics: false, comments: false, review: false },
		})

		const draftStatus = screen.getByTestId("self-media-home-post-lifecycle-post-1")
		expect(draftStatus).toHaveTextContent("To publish")
		expect(draftStatus).toHaveAttribute("data-lifecycle", "draft")

		rerender(
			<SelfMediaPostCard
				item={createPostItem()}
				title="Post One"
				subtitle="Post subtitle"
				postId="post-1"
				opsArtifacts={{ source: true, metrics: true, comments: false, review: false }}
				onOpenPost={vi.fn()}
				onPostPublishRefresh={vi.fn()}
				onConfigureAutoSync={vi.fn()}
			/>,
		)

		const syncedStatus = screen.getByTestId("self-media-home-post-lifecycle-post-1")
		expect(syncedStatus).toHaveTextContent("Data synced")
		expect(syncedStatus).toHaveAttribute("data-lifecycle", "synced")
	})

	it("prioritizes the manual publish status over inferred ops lifecycle state", () => {
		renderCard({
			item: createPostItem({ publishStatus: "archived" }),
			opsArtifacts: { source: true, metrics: true, comments: true, review: true },
			onLoadPublishedUrl: vi.fn(),
			onBindPublishedUrl: vi.fn(),
		})

		const lifecycle = screen.getByTestId("self-media-home-post-lifecycle-post-1")
		expect(lifecycle).toHaveTextContent("Paused")
		expect(lifecycle).toHaveAttribute("data-lifecycle", "archived")
		expect(screen.getByTestId("self-media-home-post-card-post-1")).toHaveAttribute(
			"data-publish-status",
			"archived",
		)
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-post-1-source"),
		).toBeInTheDocument()
	})

	it("places ops artifact shortcuts under the subtitle copy", async () => {
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockReturnValue({
				x: 0,
				y: 0,
				left: 0,
				top: 0,
				right: 390,
				bottom: 160,
				width: 390,
				height: 160,
				toJSON: () => ({}),
			})

		renderCard()

		const artifacts = screen.getByTestId("self-media-home-post-ops-artifacts-post-1")
		await waitFor(() => {
			expect(artifacts.closest(".self-media-post-card-copy")).toBeInTheDocument()
		})
		expect(screen.getByTestId("self-media-home-post-open-post-1").parentElement).toHaveClass(
			"min-h-[192px]",
			"pb-[80px]",
		)
		expect(artifacts).toHaveClass("mt-3")
		expect(artifacts.className).not.toContain("absolute")
		expect(artifacts.className).not.toContain("ml-")
		expect(artifacts.className).not.toContain("top-")
		expect(artifacts.className).not.toContain("left-")

		getBoundingClientRect.mockRestore()
	})

	it("uses the data action as immediate sync and opens auto sync settings on hover", async () => {
		const onPostPublishRefresh = vi.fn().mockResolvedValue(undefined)
		renderCard({ onPostPublishRefresh })

		const trigger = screen.getByTestId("self-media-home-post-ops-data-post-1")
		expect(trigger).toHaveAttribute("aria-label", "Sync")

		fireEvent.click(trigger)
		await waitFor(() => expect(onPostPublishRefresh).toHaveBeenCalledTimes(1))
		expect(
			screen.queryByTestId("self-media-home-post-data-popover-post-1"),
		).not.toBeInTheDocument()

		fireEvent.mouseEnter(trigger)
		expect(
			await screen.findByTestId("self-media-home-post-data-popover-post-1"),
		).toHaveTextContent("Auto sync")
		expect(
			screen.queryByTestId("self-media-home-post-data-sync-now-post-1"),
		).not.toBeInTheDocument()
	})

	it("hides the auto sync form while loading saved configuration", async () => {
		let resolveSource: (value: null) => void = () => undefined
		const onLoadOpsSource = vi.fn(
			() =>
				new Promise<null>((resolve) => {
					resolveSource = resolve
				}),
		)
		renderCard({ onLoadOpsSource })

		fireEvent.mouseEnter(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		expect(
			await screen.findByTestId("self-media-home-post-auto-sync-loading-post-1"),
		).toHaveTextContent("Loading auto sync")
		expect(
			screen.queryByTestId("self-media-home-post-auto-sync-enabled-post-1"),
		).not.toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-auto-sync-save-post-1"),
		).not.toBeInTheDocument()

		resolveSource(null)
		expect(
			await screen.findByTestId("self-media-home-post-auto-sync-enabled-post-1"),
		).toHaveValue("0")

		fireEvent.mouseEnter(screen.getByTestId("self-media-home-post-data-popover-post-1"))
		expect(
			screen.queryByTestId("self-media-home-post-auto-sync-loading-post-1"),
		).not.toBeInTheDocument()
		expect(
			screen.getByTestId("self-media-home-post-auto-sync-enabled-post-1"),
		).toBeInTheDocument()
	})

	it("treats a saved auto sync flag without task id as not configured", async () => {
		renderCard({
			onLoadOpsSource: vi.fn().mockResolvedValue({
				version: 1,
				updatedAt: "2026-06-13T10:00:00.000Z",
				platform: "rednote",
				publishedUrl: "https://www.xiaohongshu.com/explore/post-1",
				fetchStatus: "pending",
				autoSync: {
					enabled: true,
					timeConfig: {
						type: "weekly_repeat",
						time: "10:30",
						day: "2",
					},
				},
			}),
		})

		fireEvent.mouseEnter(screen.getByTestId("self-media-home-post-ops-data-post-1"))

		expect(
			await screen.findByTestId("self-media-home-post-auto-sync-enabled-post-1"),
		).toHaveValue("0")
		expect(screen.getByTestId("self-media-home-post-auto-sync-frequency-post-1")).toBeDisabled()
		expect(screen.getByTestId("self-media-home-post-auto-sync-time-post-1")).toBeDisabled()
	})

	it("opens auto sync settings on click when immediate sync is unavailable", async () => {
		renderCard({
			onPostPublishRefresh: undefined,
			onConfigureAutoSync: vi.fn(),
			onLoadOpsSource: vi.fn().mockResolvedValue(null),
		})

		const trigger = screen.getByTestId("self-media-home-post-ops-data-post-1")
		expect(trigger).toHaveAttribute("aria-label", "Auto sync")
		expect(trigger.textContent?.trim()).not.toBe("Sync")

		fireEvent.click(trigger)

		expect(
			await screen.findByTestId("self-media-home-post-data-popover-post-1"),
		).toHaveTextContent("Auto sync")
		expect(
			await screen.findByTestId("self-media-home-post-auto-sync-enabled-post-1"),
		).toBeInTheDocument()
	})

	it("opens a context menu and asks for confirmation before deleting an article", async () => {
		const onDeletePost = vi.fn().mockResolvedValue(undefined)
		renderCard({ onDeletePost })

		fireEvent.contextMenu(screen.getByTestId("self-media-home-post-card-post-1"))
		fireEvent.click(await screen.findByRole("menuitem", { name: "Delete article" }))

		expect(screen.getByRole("alertdialog")).toHaveTextContent("Delete this article?")
		expect(screen.getByRole("alertdialog")).toHaveTextContent(
			"This article will be permanently deleted and cannot be restored.",
		)
		expect(onDeletePost).not.toHaveBeenCalled()

		fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }))

		await waitFor(() => expect(onDeletePost).toHaveBeenCalledWith(createPostItem()))
	})

	it("opens the context menu from the more actions button", async () => {
		const onDeletePost = vi.fn()
		renderCard({ onDeletePost })

		fireEvent.click(screen.getByTestId("self-media-home-post-more-post-1"))

		expect(await screen.findByRole("menuitem", { name: "Delete article" })).toBeInTheDocument()
	})

	it("mentions the article folder from the context menu", async () => {
		const onMentionPost = vi.fn()
		renderCard({ onMentionPost })

		fireEvent.contextMenu(screen.getByTestId("self-media-home-post-card-post-1"))
		fireEvent.click(await screen.findByRole("menuitem", { name: "Mention this article" }))

		expect(onMentionPost).toHaveBeenCalledWith(createPostItem())
	})

	it("shares the article folder between rename and publish status actions", async () => {
		const onSharePost = vi.fn()
		renderCard({
			onRenamePost: vi.fn(),
			onSharePost,
			onSetPostPublishStatus: vi.fn(),
		})

		fireEvent.contextMenu(screen.getByTestId("self-media-home-post-card-post-1"))
		const menuItems = await screen.findAllByRole("menuitem")
		const labels = menuItems.map((item) => item.textContent?.trim())

		expect(labels.indexOf("Rename article")).toBeLessThan(labels.indexOf("Share"))
		expect(labels.indexOf("Share")).toBeLessThan(labels.indexOf("Pause publishing"))

		fireEvent.click(screen.getByRole("menuitem", { name: "Share" }))
		expect(onSharePost).toHaveBeenCalledWith(createPostItem())
	})

	it("toggles the manual publish status from the context menu", async () => {
		const onSetPostPublishStatus = vi.fn().mockResolvedValue(undefined)
		const { rerender } = renderCard({ onSetPostPublishStatus })

		fireEvent.contextMenu(screen.getByTestId("self-media-home-post-card-post-1"))
		fireEvent.click(await screen.findByRole("menuitem", { name: "Pause publishing" }))

		await waitFor(() =>
			expect(onSetPostPublishStatus).toHaveBeenCalledWith(createPostItem(), "archived"),
		)

		rerender(
			<SelfMediaPostCard
				item={createPostItem({ publishStatus: "archived" })}
				title="Post One"
				subtitle="Post subtitle"
				postId="post-1"
				opsArtifacts={{ source: false, metrics: false, comments: false, review: false }}
				onOpenPost={vi.fn()}
				onSetPostPublishStatus={onSetPostPublishStatus}
			/>,
		)

		fireEvent.contextMenu(screen.getByTestId("self-media-home-post-card-post-1"))
		fireEvent.click(await screen.findByRole("menuitem", { name: "Restore to publish" }))

		await waitFor(() =>
			expect(onSetPostPublishStatus).toHaveBeenCalledWith(
				createPostItem({ publishStatus: "archived" }),
				undefined,
			),
		)
	})

	it("opens a rename dialog from the context menu with the old name prefilled", async () => {
		const onRenamePost = vi.fn().mockResolvedValue(undefined)
		renderCard({ onRenamePost })

		fireEvent.contextMenu(screen.getByTestId("self-media-home-post-card-post-1"))
		fireEvent.click(await screen.findByRole("menuitem", { name: "Rename article" }))

		const input = screen.getByLabelText("Article name")
		const dialog = screen.getByRole("dialog")
		expect(dialog).toHaveTextContent("Rename article")
		expect(dialog).toHaveClass("overflow-hidden")
		expect(dialog).toHaveClass("p-0")
		expect(input).toHaveValue("Post One")
		expect(screen.getByRole("button", { name: "Save name" })).toHaveAttribute(
			"data-slot",
			"button",
		)

		fireEvent.change(input, { target: { value: "Renamed Post" } })
		fireEvent.click(screen.getByRole("button", { name: "Save name" }))

		await waitFor(() =>
			expect(onRenamePost).toHaveBeenCalledWith(createPostItem(), "Renamed Post"),
		)
	})

	it("shows an inline error when renaming fails", async () => {
		const onRenamePost = vi.fn().mockResolvedValue(false)
		renderCard({ onRenamePost })

		fireEvent.contextMenu(screen.getByTestId("self-media-home-post-card-post-1"))
		fireEvent.click(await screen.findByRole("menuitem", { name: "Rename article" }))
		fireEvent.change(screen.getByLabelText("Article name"), {
			target: { value: "Broken Name" },
		})
		fireEvent.click(screen.getByRole("button", { name: "Save name" }))

		expect(await screen.findByText("Failed to rename article.")).toBeInTheDocument()
		expect(screen.getByRole("dialog")).toBeInTheDocument()
	})

	it("opens the bind link form directly when the card is already in the no-link state", async () => {
		const onLoadPublishedUrl = vi.fn().mockResolvedValue(undefined)
		renderCard({
			opsArtifacts: { source: false, metrics: false, comments: false, review: false },
			onLoadPublishedUrl,
			onBindPublishedUrl: vi.fn(),
		})

		fireEvent.click(screen.getByTestId("self-media-home-post-bind-link-post-1"))

		expect(
			await screen.findByTestId("self-media-home-post-bind-link-input-post-1"),
		).toBeInTheDocument()
		expect(
			screen.queryByTestId("self-media-home-post-bind-link-loading-post-1"),
		).not.toBeInTheDocument()
		expect(onLoadPublishedUrl).not.toHaveBeenCalled()
	})

	it("uses a hydrated published link from the parent when source.json is not exposed yet", () => {
		const onLoadPublishedUrl = vi.fn()

		renderCard({
			opsArtifacts: { source: false, metrics: false, comments: false, review: false },
			publishedUrl: "https://www.xiaohongshu.com/explore/already-bound",
			onLoadPublishedUrl,
			onBindPublishedUrl: vi.fn(),
		})

		expect(
			screen.queryByTestId("self-media-home-post-bind-link-post-1"),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("self-media-home-post-lifecycle-post-1")).toHaveAttribute(
			"data-lifecycle",
			"published",
		)
		expect(screen.getByTestId("self-media-home-post-ops-data-post-1")).toBeInTheDocument()
		expect(onLoadPublishedUrl).not.toHaveBeenCalled()
	})

	it("scrolls the target card into view and opens the bind link form from a home action", async () => {
		const scrollIntoView = vi.fn()
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: scrollIntoView,
		})

		renderCard({
			opsArtifacts: { source: false, metrics: false, comments: false, review: false },
			onBindPublishedUrl: vi.fn(),
			publishedLinkAutoOpenSignal: 1,
		})

		expect(
			await screen.findByTestId("self-media-home-post-bind-link-input-post-1"),
		).toBeInTheDocument()
		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "center",
		})
	})

	it("marks created and updated artifact buttons with their matching animations", () => {
		renderCard({
			opsArtifacts: { source: true, metrics: true, comments: false, review: false },
			opsArtifactAnimations: { source: "created", metrics: "updated" },
			onLoadPublishedUrl: vi.fn(),
			onBindPublishedUrl: vi.fn(),
		})

		const source = screen.getByTestId("self-media-home-post-ops-artifact-post-1-source")
		const metrics = screen.getByTestId("self-media-home-post-ops-artifact-post-1-metrics")

		expect(source).toHaveAttribute("data-animation", "created")
		expect(metrics).toHaveAttribute("data-animation", "updated")
		expect(
			screen.getByTestId("self-media-home-post-ops-artifact-confetti-post-1-source"),
		).toBeInTheDocument()
		expect(metrics).toHaveClass("animate-bounce")
	})
})
