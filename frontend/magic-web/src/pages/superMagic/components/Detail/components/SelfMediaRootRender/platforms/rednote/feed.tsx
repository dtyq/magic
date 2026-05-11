import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { Menu, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import CardFrame, { invalidateCardFrameSourceCache } from "../../components/CardFrame"
import { SelfMediaCardContextMenu } from "../../components/SelfMediaCardContextMenu"
import { CARD_IMAGE_PROCESS } from "../../constants/imageProcess"
import { useSelfMediaStore } from "../../stores"
import type { PlatformComponentProps, SelfMediaPost } from "../../types"
import { rednoteTokens } from "./tokens"

interface FeedViewProps {
	attachmentList?: PlatformComponentProps["attachmentList"]
	onSelectPost: (idx: number) => void
	onAddCardToCurrentChat?: (postIndex: number) => void
	onAddCardToNewChat?: (postIndex: number) => void
}

interface FeedCardProps {
	post: SelfMediaPost
	postIndex: number
	attachmentList?: PlatformComponentProps["attachmentList"]
	onSelectPost: (idx: number) => void
	onEnsurePostLoaded?: (index: number) => Promise<SelfMediaPost | null>
	scrollRootRef: React.RefObject<HTMLDivElement | null>
	onAddCardToCurrentChat?: (postIndex: number) => void
	onAddCardToNewChat?: (postIndex: number) => void
}

function FeedPostSkeleton({ postId }: { postId: string }) {
	return (
		<>
			<div
				className="aspect-[3/4] w-full bg-gradient-to-b from-[#f9f9f9] to-[#efefef]"
				data-testid={`red-feed-post-loading-${postId}`}
			/>
			<div className="space-y-2 px-3 py-2.5">
				<div className="h-4 w-full animate-pulse rounded bg-[#f2f3f5]" />
				<div className="h-4 w-2/3 animate-pulse rounded bg-[#f2f3f5]" />
				<div className="flex items-center justify-between pt-1">
					<div className="h-3 w-20 animate-pulse rounded bg-[#f2f3f5]" />
					<div className="h-3 w-10 animate-pulse rounded bg-[#f2f3f5]" />
				</div>
			</div>
		</>
	)
}

function isElementVisibleInRoot(element: HTMLElement, root?: HTMLElement | null) {
	const rect = element.getBoundingClientRect()
	const rootRect = root?.getBoundingClientRect()

	const topBoundary = rootRect?.top ?? 0
	const leftBoundary = rootRect?.left ?? 0
	const bottomBoundary = rootRect?.bottom ?? window.innerHeight
	const rightBoundary = rootRect?.right ?? window.innerWidth

	return (
		rect.bottom > topBoundary - 240 &&
		rect.top < bottomBoundary + 240 &&
		rect.right > leftBoundary &&
		rect.left < rightBoundary
	)
}

function useLazyCover(scrollRootRef: React.RefObject<HTMLDivElement | null>) {
	const ref = useRef<HTMLDivElement | null>(null)
	const [shouldLoad, setShouldLoad] = useState(false)

	useEffect(() => {
		const node = ref.current
		if (!node || shouldLoad) return
		const scrollRoot = scrollRootRef.current
		if (isElementVisibleInRoot(node, scrollRoot)) {
			setShouldLoad(true)
			return
		}
		if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") {
			setShouldLoad(true)
			return
		}

		const observer = new window.IntersectionObserver(
			(entries) => {
				const entry = entries[0]
				if (!entry?.isIntersecting) return
				setShouldLoad(true)
				observer.disconnect()
			},
			{
				root: scrollRoot,
				rootMargin: "240px 0px",
				threshold: 0.01,
			},
		)

		observer.observe(node)
		return () => observer.disconnect()
	}, [scrollRootRef, shouldLoad])

	return { ref, shouldLoad }
}

function RednoteFeedHeader() {
	const { t } = useTranslation("super")

	return (
		<div
			className="sticky top-0 z-10 flex items-center gap-4 border-b border-black/5 bg-white px-4 pb-2 pt-3"
			data-testid="red-feed-header"
		>
			<button
				type="button"
				className="flex h-9 w-9 items-center justify-center rounded-full text-black"
				data-testid="red-feed-header-menu-button"
				aria-label={t("detail.selfMedia.platform.rednote.feedHeader.menu")}
			>
				<Menu className="h-5 w-5" />
			</button>
			<div className="flex min-w-0 flex-1 items-center justify-center gap-7 text-[14px]">
				<span
					className="font-medium text-black/45"
					data-testid="red-feed-header-following-tab"
				>
					{t("detail.selfMedia.platform.rednote.feedHeader.following")}
				</span>
				<span
					className="relative text-[17px] font-semibold text-black"
					data-testid="red-feed-header-discover-tab"
				>
					{t("detail.selfMedia.platform.rednote.feedHeader.discover")}
					<span
						className="absolute -bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full"
						style={{ background: rednoteTokens.brand }}
					/>
				</span>
				<span className="font-medium text-black/45" data-testid="red-feed-header-local-tab">
					{t("detail.selfMedia.platform.rednote.feedHeader.local")}
				</span>
			</div>
			<button
				type="button"
				className="flex h-9 w-9 items-center justify-center rounded-full text-black"
				data-testid="red-feed-header-search-button"
				aria-label={t("detail.selfMedia.platform.rednote.feedHeader.search")}
			>
				<Search className="h-5 w-5" />
			</button>
		</div>
	)
}

function RednoteFeedCard({
	post,
	postIndex,
	attachmentList,
	onSelectPost,
	onEnsurePostLoaded,
	scrollRootRef,
	onAddCardToCurrentChat,
	onAddCardToNewChat,
}: FeedCardProps) {
	const { t } = useTranslation("super")
	const store = useSelfMediaStore()
	const { ref, shouldLoad } = useLazyCover(scrollRootRef)
	const requestedPostLoadRef = useRef(false)
	const [coverLoaded, setCoverLoaded] = useState(false)
	const [coverRefreshVersion, setCoverRefreshVersion] = useState(0)
	const [slotWidth, setSlotWidth] = useState(0)
	const [postLoading, setPostLoading] = useState(false)
	const coverCard = post.cards[0]
	const title =
		post.meta.feedTitle || post.meta.title || t("detail.selfMedia.common.untitledPost")
	const author = post.meta.author || t("detail.selfMedia.common.unknownAuthor")
	const likes = post.meta.feedLikes
	const shouldRenderCoverFrame = Boolean(coverCard?.fileId && shouldLoad)
	const reservedHeight = slotWidth > 0 ? (slotWidth * 4) / 3 : undefined
	const isPostLoading = postLoading && !coverCard?.fileId

	useEffect(() => {
		setCoverLoaded(false)
	}, [coverCard?.fileId, shouldLoad])

	useEffect(() => {
		if (!coverCard?.fileId) return
		setPostLoading(false)
	}, [coverCard?.fileId])

	useEffect(() => {
		let cancelled = false
		if (
			!shouldLoad ||
			coverCard?.fileId ||
			requestedPostLoadRef.current ||
			!onEnsurePostLoaded
		) {
			return
		}
		requestedPostLoadRef.current = true
		setPostLoading(true)
		void onEnsurePostLoaded(postIndex).finally(() => {
			if (cancelled) return
			setPostLoading(false)
		})
		return () => {
			cancelled = true
		}
	}, [coverCard?.fileId, onEnsurePostLoaded, post.meta.id, postIndex, shouldLoad])

	useEffect(() => {
		const node = ref.current
		if (!node || typeof ResizeObserver === "undefined") return

		const syncSlotWidth = () => {
			const width = node.getBoundingClientRect().width
			setSlotWidth((prev) => (prev === width ? prev : width))
		}

		syncSlotWidth()
		const observer = new ResizeObserver(() => {
			syncSlotWidth()
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [ref])

	return (
		<div
			className="mb-2 break-inside-avoid"
			data-testid={`red-feed-column-item-${post.meta.id}`}
		>
			<SelfMediaCardContextMenu
				addToCurrentChatLabel={t("fileViewer.addToCurrentChat")}
				addToNewChatLabel={t("fileViewer.addToNewChat")}
				refreshLabel={t("detail.selfMedia.edit.refreshCard")}
				goToEditLabel={t("detail.selfMedia.edit.goToEdit")}
				onAddToCurrentChat={
					onAddCardToCurrentChat ? () => onAddCardToCurrentChat(postIndex) : undefined
				}
				onAddToNewChat={
					onAddCardToNewChat ? () => onAddCardToNewChat(postIndex) : undefined
				}
				onRefresh={() => {
					invalidateCardFrameSourceCache(coverCard?.fileId)
					setCoverRefreshVersion((v) => v + 1)
					setCoverLoaded(false)
				}}
				onGoToEdit={() => {
					store.setActivePostIndex(postIndex)
					store.setActiveCardIndex(0)
					store.setView("edit")
				}}
				testIds={{
					addCurrent: `red-feed-card-add-current-chat-menu-item`,
					addNew: `red-feed-card-add-new-chat-menu-item`,
					refresh: `red-feed-card-refresh-menu-item`,
					goToEdit: `red-feed-card-go-to-edit-menu-item`,
				}}
			>
				<button
					type="button"
					onClick={() => onSelectPost(postIndex)}
					data-testid={`red-feed-card-${postIndex}`}
					className="flex w-full flex-col overflow-hidden rounded-sm bg-white text-left shadow-sm"
				>
					{isPostLoading ? (
						<div ref={ref} data-testid={`red-feed-cover-slot-${post.meta.id}`}>
							<FeedPostSkeleton postId={post.meta.id} />
						</div>
					) : (
						<>
							<div
								ref={ref}
								className="relative overflow-hidden rounded-t-sm bg-[#f5f5f5]"
								style={{
									minHeight:
										shouldRenderCoverFrame && !coverLoaded
											? reservedHeight
											: undefined,
								}}
								data-testid={`red-feed-cover-slot-${post.meta.id}`}
							>
								{shouldRenderCoverFrame ? (
									<>
										{!coverLoaded ? (
											<div
												className="absolute inset-0 bg-gradient-to-b from-[#f9f9f9] to-[#efefef]"
												data-testid={`red-feed-cover-placeholder-${post.meta.id}`}
											/>
										) : null}
										<CardFrame
											cardId={`red-feed-cover-${post.meta.id}-${coverRefreshVersion}`}
											fileId={coverCard.fileId}
											version={coverCard.version}
											attachmentList={attachmentList}
											autoHeight
											imageProcessOptions={CARD_IMAGE_PROCESS}
											onLoaded={() => {
												setCoverLoaded(true)
											}}
											className="pointer-events-none w-full transition-opacity duration-200"
											style={{ opacity: coverLoaded ? 1 : 0 }}
										/>
									</>
								) : (
									<div
										className="aspect-[3/4] w-full bg-gradient-to-b from-[#f9f9f9] to-[#efefef]"
										data-testid={`red-feed-cover-placeholder-${post.meta.id}`}
									/>
								)}
							</div>
							<div className="space-y-1.5 px-3 py-2.5">
								{title ? (
									<div className="line-clamp-2 text-[13px] font-medium leading-5 text-black">
										{title}
									</div>
								) : null}
								<div className="flex items-center justify-between gap-2 text-[11px] text-[#86909c]">
									<span className="truncate">{author}</span>
									{likes ? (
										<span className="flex-shrink-0">♥ {likes}</span>
									) : null}
								</div>
							</div>
						</>
					)}
				</button>
			</SelfMediaCardContextMenu>
		</div>
	)
}

const RednoteFeedView = observer(function RednoteFeedView({
	attachmentList,
	onSelectPost,
	onAddCardToCurrentChat,
	onAddCardToNewChat,
}: FeedViewProps) {
	const scrollRootRef = useRef<HTMLDivElement>(null)
	const store = useSelfMediaStore()
	const { posts } = store
	const ensurePostLoaded = (index: number) => store.ensurePostLoaded(index)

	return (
		<div
			ref={scrollRootRef}
			className="scrollbar-hide h-full overflow-y-auto bg-[#f6f6f6]"
			data-testid="red-feed-view"
		>
			<RednoteFeedHeader />
			<div className="columns-2 gap-2 px-2 py-2 [column-fill:_balance]">
				{posts.map((post, idx) => (
					<RednoteFeedCard
						key={post.meta.id || idx}
						post={post}
						postIndex={idx}
						attachmentList={attachmentList}
						onSelectPost={onSelectPost}
						onEnsurePostLoaded={ensurePostLoaded}
						scrollRootRef={scrollRootRef}
						onAddCardToCurrentChat={onAddCardToCurrentChat}
						onAddCardToNewChat={onAddCardToNewChat}
					/>
				))}
			</div>
		</div>
	)
})

export default RednoteFeedView
