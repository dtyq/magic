import { useEffect, useRef, useState } from "react"
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import type { CardFrameRef } from "../../components/CardFrame"
import CardFrame, { invalidateCardFrameSourceCache } from "../../components/CardFrame"
import { CardActionStrip } from "../../components/CardActionStrip"
import { SelfMediaCardContextMenu } from "../../components/SelfMediaCardContextMenu"
import { CARD_IMAGE_PROCESS } from "../../constants/imageProcess"
import { useSelfMediaStore } from "../../stores"
import { useCarousel } from "../../hooks/useCarousel"
import type { PlatformComponentProps, SelfMediaPost } from "../../types"
import { instagramTokens } from "./tokens"

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

function useLazyCell(scrollRootRef: React.RefObject<HTMLDivElement | null>) {
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

interface FeedProps {
	posts: SelfMediaPost[]
	attachmentList?: PlatformComponentProps["attachmentList"]
	onSelectPost: (idx: number) => void
	onEnsurePostLoaded?: (index: number) => Promise<SelfMediaPost | null>
	onAddCardToCurrentChat?: (postIndex: number) => void
}

function InstagramFeedView({
	posts,
	attachmentList,
	onSelectPost,
	onEnsurePostLoaded,
	onAddCardToCurrentChat,
}: FeedProps) {
	const scrollRootRef = useRef<HTMLDivElement>(null)

	return (
		<div
			ref={scrollRootRef}
			className="scrollbar-hide flex h-full flex-col overflow-y-auto overflow-x-hidden bg-white"
			data-testid="ig-feed-view"
		>
			<div className="sticky top-0 z-50 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[#dbdbdb] bg-white px-4 py-2">
				<div className="flex items-center">
					<svg
						width="26"
						height="26"
						viewBox="0 0 24 24"
						fill="none"
						stroke="#262626"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<rect x="3" y="3" width="18" height="18" rx="4" />
						<line x1="12" y1="8" x2="12" y2="16" />
						<line x1="8" y1="12" x2="16" y2="12" />
					</svg>
				</div>
				<div
					className="text-[28px] font-normal leading-none tracking-[-0.5px] text-[#262626]"
					style={{ fontFamily: "'Billabong', 'Instagram Sans', cursive, sans-serif" }}
				>
					Instagram
				</div>
				<div className="flex items-center justify-end">
					<svg
						width="26"
						height="26"
						viewBox="0 0 24 24"
						fill="none"
						stroke="#262626"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
					</svg>
				</div>
			</div>
			{posts.map((post, postIdx) => (
				<InstagramFeedPostCell
					key={post.meta.id || postIdx}
					post={post}
					postIdx={postIdx}
					attachmentList={attachmentList}
					scrollRootRef={scrollRootRef}
					onSelectPost={onSelectPost}
					onEnsurePostLoaded={onEnsurePostLoaded}
					onAddCardToCurrentChat={onAddCardToCurrentChat}
				/>
			))}
		</div>
	)
}

interface FeedPostCellProps {
	post: SelfMediaPost
	postIdx: number
	scrollRootRef: React.RefObject<HTMLDivElement | null>
	onSelectPost: (idx: number) => void
	onEnsurePostLoaded?: (index: number) => Promise<SelfMediaPost | null>
	attachmentList?: PlatformComponentProps["attachmentList"]
	onAddCardToCurrentChat?: (postIndex: number) => void
}

function InstagramFeedPostCell({
	post,
	postIdx,
	attachmentList,
	scrollRootRef,
	onSelectPost,
	onEnsurePostLoaded,
	onAddCardToCurrentChat,
}: FeedPostCellProps) {
	const { t } = useTranslation("super")
	const store = useSelfMediaStore()
	const [cardRefreshVersions, setCardRefreshVersions] = useState<Record<number, number>>({})
	const { ref, shouldLoad } = useLazyCell(scrollRootRef)
	const requestedPostLoadRef = useRef(false)
	const displayAuthor = post.meta.author || t("detail.selfMedia.common.unknownAuthor")
	const authorInitial = post.meta.author?.[0]?.toUpperCase() || displayAuthor[0]?.toUpperCase()
	const displayTitle =
		post.meta.title || post.meta.feedTitle || t("detail.selfMedia.common.untitledPost")

	useEffect(() => {
		if (
			!shouldLoad ||
			post.cards[0]?.fileId ||
			requestedPostLoadRef.current ||
			!onEnsurePostLoaded
		) {
			return
		}
		requestedPostLoadRef.current = true
		void onEnsurePostLoaded(postIdx)
	}, [onEnsurePostLoaded, post.cards, postIdx, shouldLoad])

	const handleControlPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
		event.stopPropagation()
	}

	const {
		bind,
		dragOffset,
		index: currentIndex,
		goTo,
		next,
		prev,
	} = useCarousel<HTMLDivElement>({
		total: post.cards.length,
		initialIndex: 0,
	})

	const showNavigation = post.cards.length > 1
	const showContent = Boolean(post.cards[0]?.fileId && shouldLoad)

	return (
		<div
			ref={ref}
			className="flex flex-col border-b border-[#efefef] bg-white pb-3"
			data-testid={`ig-feed-post-${post.meta.id}`}
		>
			<div className="flex items-center gap-2 px-2 py-2">
				<div
					className="flex shrink-0 cursor-pointer items-center gap-2"
					onClick={() => onSelectPost(postIdx)}
				>
					<div
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-[2px]"
						style={{ background: instagramTokens.gradient }}
					>
						<div className="flex h-full w-full items-center justify-center rounded-full border-[1.5px] border-white bg-[#888] text-[12px] font-black text-white">
							{authorInitial}
						</div>
					</div>
				</div>
				<div
					className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center"
					onClick={() => onSelectPost(postIdx)}
				>
					<div className="truncate text-[13px] font-bold tracking-tight text-[#111]">
						{displayAuthor}
					</div>
					<div className="text-[11px] text-[#737373]">为你推荐</div>
				</div>
				<button
					type="button"
					className="shrink-0 bg-transparent px-2 py-1 text-[13.5px] font-bold text-[#0095f6]"
				>
					关注
				</button>
				<button
					type="button"
					className="flex shrink-0 items-center px-1 py-1 text-[#111]"
					aria-label="More"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
						<circle cx="5" cy="12" r="1.5" />
						<circle cx="12" cy="12" r="1.5" />
						<circle cx="19" cy="12" r="1.5" />
					</svg>
				</button>
			</div>

			<div
				ref={bind.ref}
				onPointerDown={bind.onPointerDown}
				onPointerMove={bind.onPointerMove}
				onPointerUp={bind.onPointerUp}
				onPointerCancel={bind.onPointerCancel}
				className="group relative w-full shrink-0 touch-pan-y overflow-hidden bg-[#fafafa]"
			>
				{showContent ? (
					<div
						className="flex h-full w-full transition-transform"
						style={{
							transform: `translateX(calc(${-currentIndex * 100}% + ${dragOffset}px))`,
						}}
					>
						{post.cards.map((card, c) => (
							<SelfMediaCardContextMenu
								key={`${card.fileId || card.path || c}_${card.version ?? ""}`}
								addToCurrentChatLabel={t("fileViewer.addToCurrentChat")}
								refreshLabel={t("detail.selfMedia.edit.refreshCard")}
								goToEditLabel={t("detail.selfMedia.edit.goToEdit")}
								onRefresh={() => {
									invalidateCardFrameSourceCache(card.fileId)
									setCardRefreshVersions((prev) => ({
										...prev,
										[c]: (prev[c] ?? 0) + 1,
									}))
								}}
								onAddToCurrentChat={
									onAddCardToCurrentChat
										? () => onAddCardToCurrentChat(postIdx)
										: undefined
								}
								onGoToEdit={() => {
									store.setActivePostIndex(postIdx)
									store.setActiveCardIndex(c)
									store.setView("edit")
								}}
								testIds={{
									refresh: `ig-feed-card-refresh-menu-item`,
									goToEdit: `ig-feed-card-go-to-edit-menu-item`,
								}}
							>
								<div className="h-full w-full flex-shrink-0">
									<CardFrame
										cardId={`ig-feed-${post.meta.id}-${c}-${cardRefreshVersions[c] ?? 0}`}
										fileId={card.fileId}
										version={card.version}
										attachmentList={attachmentList}
										imageProcessOptions={CARD_IMAGE_PROCESS}
										className="pointer-events-none h-full w-full"
									/>
								</div>
							</SelfMediaCardContextMenu>
						))}
					</div>
				) : (
					<div className="flex h-full w-full items-center justify-center bg-[#efefef] text-[#8e8e8e]">
						...
					</div>
				)}

				{showContent && showNavigation ? (
					<>
						<button
							type="button"
							className={cn(
								"absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 shadow-sm transition-opacity",
								"group-hover:opacity-100",
								currentIndex === 0 && "pointer-events-none opacity-0",
							)}
							onPointerDown={handleControlPointerDown}
							onClick={prev}
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<button
							type="button"
							className={cn(
								"absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 shadow-sm transition-opacity",
								"group-hover:opacity-100",
								currentIndex >= post.cards.length - 1 &&
									"pointer-events-none opacity-0",
							)}
							onPointerDown={handleControlPointerDown}
							onClick={next}
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</>
				) : null}
			</div>

			<div className="px-3 pt-3">
				<div className="relative mb-2 flex items-center justify-between">
					<div className="flex gap-4">
						<Heart className="h-6 w-6 text-[#262626]" strokeWidth={1.5} />
						<MessageCircle className="h-6 w-6 text-[#262626]" strokeWidth={1.5} />
						<Send className="h-6 w-6 text-[#262626]" strokeWidth={1.5} />
					</div>
					{showNavigation && showContent ? (
						<div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-[4px]">
							{post.cards.map((_, idx) => (
								<button
									key={idx}
									type="button"
									onPointerDown={handleControlPointerDown}
									onClick={() => goTo(idx)}
									className={cn(
										"h-[6px] w-[6px] rounded-full transition-all",
										idx === currentIndex ? "bg-[#3897f0]" : "bg-[#dbdbdb]",
									)}
								/>
							))}
						</div>
					) : null}
					<Bookmark className="h-6 w-6 text-[#262626]" strokeWidth={1.5} />
				</div>
				<div className="mb-1 text-[13px] font-semibold text-[#262626]">
					{post.meta.feedLikes || "0"} likes
				</div>
				<div className="text-[13px] text-[#262626]">
					<span className="mr-1 font-semibold">{displayAuthor}</span>
					{displayTitle}
				</div>
				<button
					type="button"
					className="mt-1 text-[13px] text-[#8e8e8e]"
					onClick={() => onSelectPost(postIdx)}
				>
					View all {post.meta.commentCount || post.meta.comments?.length || 0} comments
				</button>
				<div className="mt-1 text-[10px] uppercase tracking-wider text-[#8e8e8e]">
					{post.meta.time || "Just now"}
				</div>
			</div>
		</div>
	)
}

interface DetailProps {
	post: SelfMediaPost
	cardIndex: number
	attachmentList?: PlatformComponentProps["attachmentList"]
	cardRefs: React.MutableRefObject<Array<Array<CardFrameRef | null>>>
	postIndex: number
	onChangeCard: (idx: number) => void
	onBackHome: () => void
	backLabel: string
	onAddCardToCurrentChat?: (cardIndex: number) => void
	onAddCardToNewChat?: (cardIndex: number) => void
	/** Increment to force-refresh the currently active card */
	activeCardExternalRefreshVersion?: number
}

function InstagramDetailView({
	post,
	cardIndex,
	attachmentList,
	cardRefs,
	postIndex,
	onChangeCard,
	onBackHome,
	backLabel,
	onAddCardToCurrentChat,
	activeCardExternalRefreshVersion,
}: DetailProps) {
	const { t } = useTranslation("super")
	const store = useSelfMediaStore()
	const [cardRefreshVersions, setCardRefreshVersions] = useState<Record<number, number>>({})
	const displayAuthor = post.meta.author || t("detail.selfMedia.common.unknownAuthor")
	const authorInitial = post.meta.author?.[0]?.toUpperCase() || displayAuthor[0]?.toUpperCase()
	const displayTitle =
		post.meta.title || post.meta.feedTitle || t("detail.selfMedia.common.untitledPost")

	// Triggered by external refresh signal (e.g. action strip refresh button)
	useEffect(() => {
		if (!activeCardExternalRefreshVersion) return
		const card = post.cards[cardIndex]
		if (!card?.fileId) return
		invalidateCardFrameSourceCache(card.fileId)
		setCardRefreshVersions((prev) => ({
			...prev,
			[cardIndex]: (prev[cardIndex] ?? 0) + 1,
		}))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeCardExternalRefreshVersion])

	const handleControlPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
		event.stopPropagation()
	}
	const handleDetailWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		event.stopPropagation()
	}
	const {
		bind,
		dragOffset,
		index: currentIndex,
		goTo,
		next,
		prev,
	} = useCarousel<HTMLDivElement>({
		total: post.cards.length,
		initialIndex: cardIndex,
	})
	useEffect(() => {
		if (currentIndex !== cardIndex) {
			onChangeCard(currentIndex)
		}
	}, [cardIndex, currentIndex, onChangeCard])
	const showNavigation = post.cards.length > 1
	return (
		<div
			className="scrollbar-hide flex h-full flex-col overflow-y-auto overflow-x-hidden bg-white"
			onWheel={handleDetailWheel}
		>
			<div className="sticky top-0 z-50 flex shrink-0 items-center justify-between border-b border-[#efefef] bg-white px-2 py-2">
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={onBackHome}
						aria-label={backLabel}
						data-testid="ig-detail-header-back"
						className="ml-[-4px] flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[#262626]"
					>
						<ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
					</button>
					<div className="flex items-center gap-2">
						<div
							className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-[2px]"
							style={{ background: instagramTokens.gradient }}
						>
							<div className="flex h-full w-full items-center justify-center rounded-full border-[1.5px] border-white bg-[#888] text-[11px] font-black text-white">
								{authorInitial}
							</div>
						</div>
						<div className="text-[14px] font-bold tracking-tight text-[#111]">
							{displayAuthor}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						className="rounded-full border border-[#0095f6] px-3.5 py-1 text-[12px] font-bold text-[#0095f6]"
					>
						关注
					</button>
					<button
						type="button"
						className="flex items-center p-1 text-[#111]"
						aria-label="More"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
							<circle cx="5" cy="12" r="1.5" />
							<circle cx="12" cy="12" r="1.5" />
							<circle cx="19" cy="12" r="1.5" />
						</svg>
					</button>
				</div>
			</div>
			<div
				ref={bind.ref}
				onPointerDown={bind.onPointerDown}
				onPointerMove={bind.onPointerMove}
				onPointerUp={bind.onPointerUp}
				onPointerCancel={bind.onPointerCancel}
				className="group relative w-full shrink-0 touch-pan-y overflow-hidden bg-black"
				data-testid="ig-detail-stage"
			>
				<div
					className="flex h-full w-full transition-transform"
					style={{
						transform: `translateX(calc(${-currentIndex * 100}% + ${dragOffset}px))`,
					}}
				>
					{post.cards.map((card, c) => (
						<div
							key={`${card.fileId || card.path || c}_${card.version ?? ""}`}
							className="h-full w-full flex-shrink-0"
							data-testid={`ig-detail-card-${c}`}
						>
							<CardFrame
								cardId={`ig-detail-${post.meta.id}-${c}-${cardRefreshVersions[c] ?? 0}`}
								fileId={card.fileId}
								version={card.version}
								attachmentList={attachmentList}
								imageProcessOptions={CARD_IMAGE_PROCESS}
								className="pointer-events-none h-full w-full"
								ref={(node) => {
									cardRefs.current[postIndex] = cardRefs.current[postIndex] || []
									cardRefs.current[postIndex][c] = node
								}}
							/>
						</div>
					))}
				</div>
				{showNavigation ? (
					<>
						<button
							type="button"
							className={cn(
								"absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 shadow-sm transition-opacity",
								"group-hover:opacity-100",
								currentIndex === 0 && "pointer-events-none opacity-0",
							)}
							onPointerDown={handleControlPointerDown}
							onClick={prev}
							data-testid="instagram-detail-prev-button"
							aria-label="Previous card"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<button
							type="button"
							className={cn(
								"absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 shadow-sm transition-opacity",
								"group-hover:opacity-100",
								currentIndex >= post.cards.length - 1 &&
									"pointer-events-none opacity-0",
							)}
							onPointerDown={handleControlPointerDown}
							onClick={next}
							data-testid="instagram-detail-next-button"
							aria-label="Next card"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</>
				) : null}
				<div className="absolute inset-x-0 -bottom-6 flex justify-center gap-1">
					{post.cards.map((_, idx) => (
						<button
							key={idx}
							type="button"
							onPointerDown={handleControlPointerDown}
							onClick={() => goTo(idx)}
							data-testid={`ig-detail-dot-${idx}`}
							className={cn(
								"h-1.5 w-1.5 rounded-full transition-all",
								idx === currentIndex ? "bg-[#3897f0]" : "bg-[#dbdbdb]",
							)}
						/>
					))}
				</div>
			</div>

			<div className="px-3 pb-3 pt-3">
				<div className="mb-2 flex items-center justify-between">
					<div className="flex gap-4">
						<Heart className="h-6 w-6 text-[#262626]" strokeWidth={1.5} />
						<MessageCircle className="h-6 w-6 text-[#262626]" strokeWidth={1.5} />
						<Send className="h-6 w-6 text-[#262626]" strokeWidth={1.5} />
					</div>
					<Bookmark className="h-6 w-6 text-[#262626]" strokeWidth={1.5} />
				</div>
				<div className="mb-1 text-[13px] font-semibold text-[#262626]">
					{post.meta.feedLikes || "0"} likes
				</div>
				<div className="text-[13px] text-[#262626]">
					<span className="mr-1 font-semibold">{displayAuthor}</span>
					{displayTitle}
				</div>
				<div className="mt-1 text-[13px] text-[#8e8e8e]">
					View all {post.meta.commentCount || post.meta.comments?.length || 0} comments
				</div>
			</div>

			<InstagramComments post={post} />
		</div>
	)
}

function InstagramComments({ post }: { post: SelfMediaPost }) {
	const { t } = useTranslation("super")
	const comments = post.meta.comments || []
	if (!comments.length) return null
	return (
		<div className="border-t border-[#efefef] bg-white p-3 text-[13px] text-[#262626]">
			<div className="mb-2 text-[13px] font-semibold text-[#262626]">
				{t("detail.selfMedia.platform.instagram.commentsTotal", {
					count: Number(post.meta.commentCount || comments.length),
				})}
			</div>
			<div className="space-y-3">
				{comments.map((c, idx) => (
					<div key={idx} className="flex gap-2">
						<div
							className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
							style={{ background: c.avatarColor || instagramTokens.gradient }}
						>
							{c.avatarChar ||
								c.name?.[0] ||
								t("detail.selfMedia.common.unknownAuthor")[0]}
						</div>
						<div className="flex-1 text-[#262626]">
							<span className="mr-1 font-semibold">
								{c.name || t("detail.selfMedia.common.unknownAuthor")}
							</span>
							{c.text}
							<div className="mt-0.5 text-[11px] text-[#8e8e8e]">
								{c.time} · {c.location} · ♥ {c.likes}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

interface ScrollProps {
	post: SelfMediaPost
	attachmentList?: PlatformComponentProps["attachmentList"]
	allowEdit?: boolean
	cardRefs: React.MutableRefObject<Array<Array<CardFrameRef | null>>>
	postIndex: number
	onAddCardToCurrentChat?: (cardIndex: number) => void
}

function InstagramScrollView({
	post,
	attachmentList,
	allowEdit,
	cardRefs,
	postIndex,
	onAddCardToCurrentChat,
}: ScrollProps) {
	const store = useSelfMediaStore()
	const [cardRefreshVersions, setCardRefreshVersions] = useState<Record<number, number>>({})
	return (
		<div className="h-full overflow-y-auto" data-testid="instagram-scroll-view">
			<div className="space-y-2 p-2">
				{post.cards.map((card, c) => (
					<div
						key={`${card.fileId || card.path || c}_${card.version ?? ""}`}
						className="flex items-start gap-1"
					>
						<div
							className="min-w-0 flex-1 overflow-hidden rounded-sm border border-[#dbdbdb] bg-white shadow-sm"
							data-testid={`ig-scroll-card-${c}`}
						>
							<CardFrame
								cardId={`ig-scroll-${post.meta.id}-${c}-${cardRefreshVersions[c] ?? 0}`}
								fileId={card.fileId}
								version={card.version}
								attachmentList={attachmentList}
								autoHeight
								imageProcessOptions={CARD_IMAGE_PROCESS}
								className="pointer-events-none"
								ref={(node) => {
									cardRefs.current[postIndex] = cardRefs.current[postIndex] || []
									cardRefs.current[postIndex][c] = node
								}}
							/>
						</div>
						<CardActionStrip
							className="shrink-0 pt-1"
							allowEdit={allowEdit}
							onAddToCurrentChat={
								onAddCardToCurrentChat ? () => onAddCardToCurrentChat(c) : undefined
							}
							onGoToEdit={() => {
								store.setActiveCardIndex(c)
								store.setView("edit")
							}}
							onRefresh={() => {
								invalidateCardFrameSourceCache(card.fileId)
								setCardRefreshVersions((prev) => ({
									...prev,
									[c]: (prev[c] ?? 0) + 1,
								}))
							}}
							testIdPrefix={`ig-scroll-card-${c}`}
							fileId={card.fileId}
							attachmentList={attachmentList}
						/>
					</div>
				))}
			</div>
		</div>
	)
}

export interface InstagramFooterLabels {
	home: string
	search: string
	create: string
	reels: string
	profile: string
}

function InstagramFooterView({ labels }: { labels: InstagramFooterLabels }) {
	return (
		<div className="flex h-[50px] shrink-0 items-center justify-around border-t border-[#dbdbdb] bg-white pb-1 pt-1 text-[#262626]">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
			</svg>
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<polygon points="23 7 16 12 23 17 23 7" />
				<rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
			</svg>
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<polygon points="22 2 15 22 11 13 2 9 22 2" />
			</svg>
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		</div>
	)
}

export { InstagramDetailView, InstagramFeedView, InstagramFooterView, InstagramScrollView }
