import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { ChevronLeft, ChevronRight, ExternalLink, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import type { CardFrameRef } from "../../components/CardFrame"
import CardFrame, { invalidateCardFrameSourceCache } from "../../components/CardFrame"
import { CardActionStrip } from "../../components/CardActionStrip"
import { CARD_IMAGE_PROCESS } from "../../constants/imageProcess"
import { useCarousel } from "../../hooks/useCarousel"
import { useSelfMediaStore } from "../../stores"
import type { PlatformComponentProps, SelfMediaPost } from "../../types"
import { rednoteTokens } from "./tokens"

interface DetailViewProps {
	attachmentList?: PlatformComponentProps["attachmentList"]
	cardRefs: React.MutableRefObject<Array<Array<CardFrameRef | null>>>
	onBackHome: () => void
	backLabel: string
	onChangeCard: (idx: number) => void
	onAddCardToCurrentChat?: (idx: number) => void
	/** Increment this value to force-refresh the currently active card */
	activeCardExternalRefreshVersion?: number
}

interface ScrollViewProps {
	attachmentList?: PlatformComponentProps["attachmentList"]
	allowEdit?: boolean
	cardRefs: React.MutableRefObject<Array<Array<CardFrameRef | null>>>
	postIndex: number
	onAddCardToCurrentChat?: (idx: number) => void
	onAddActivePostDirectoryToCurrentChat?: () => void
}

function RednoteDetailHeader({
	post,
	onBackHome,
	backLabel,
}: {
	post: SelfMediaPost
	onBackHome: () => void
	backLabel: string
}) {
	const { t } = useTranslation("super")
	const authorName =
		post.meta.author ||
		post.meta.title ||
		post.meta.feedTitle ||
		t("detail.selfMedia.common.unknownAuthor")
	const subtitle = post.meta.feedTitle || post.meta.title

	return (
		<div
			className="sticky -top-0.5 z-[100] flex items-center gap-3 border-b border-black/5 bg-white px-3 py-2"
			data-testid="red-detail-header"
		>
			<button
				type="button"
				onClick={onBackHome}
				aria-label={backLabel}
				className="flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-black"
				data-testid="red-detail-header-back"
			>
				<ChevronLeft className="size-full" />
			</button>
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<div
					className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
					style={{ background: rednoteTokens.brand }}
				>
					{authorName[0]}
				</div>
				<div className="min-w-0">
					<div className="truncate text-[13px] font-semibold text-black">
						{authorName}
					</div>
					{/* {subtitle ? (
						<div className="truncate text-[11px] text-[#86909c]">{subtitle}</div>
					) : null} */}
				</div>
			</div>
			<div
				className="flex h-8 w-8 items-center justify-center text-black"
				data-testid="red-detail-header-share"
			>
				<ExternalLink className="h-4 w-4" />
			</div>
		</div>
	)
}

function RednoteDetailContent({ post }: { post: SelfMediaPost }) {
	const title = post.meta.title || post.meta.feedTitle
	const subtitle = post.meta.subtitle
	const tags = post.meta.tags
	const metaLine = [post.meta.time, post.meta.location].filter(Boolean).join(" ")

	if (!title && !subtitle && !tags && !metaLine) {
		return null
	}

	return (
		<div className="bg-white px-4 py-3 shadow-sm" data-testid="red-detail-content">
			{title ? (
				<div className="text-[16px] font-semibold leading-6 text-black">{title}</div>
			) : null}
			{subtitle ? (
				<div className="mt-2 text-[14px] leading-6 text-black/80">{subtitle}</div>
			) : null}
			{tags ? (
				<div className="mt-2 text-[15px] font-medium leading-6 text-[#1f6fff]">{tags}</div>
			) : null}
			{metaLine ? (
				<div className="mt-3 text-[12px] leading-5 text-[#86909c]">{metaLine}</div>
			) : null}
		</div>
	)
}

export const RednoteDetailView = observer(function RednoteDetailView({
	attachmentList,
	cardRefs,
	onBackHome,
	backLabel,
	onChangeCard,
	onAddCardToCurrentChat,
	activeCardExternalRefreshVersion,
}: DetailViewProps) {
	const store = useSelfMediaStore()
	const { activePost: post, activeCardIndex: cardIndex, activePostIndex: postIndex } = store
	const detailRootRef = useRef<HTMLDivElement>(null)
	const [cardRefreshVersions, setCardRefreshVersions] = useState<Record<number, number>>({})

	// Triggered by external refresh signal (e.g. action strip refresh button)
	useEffect(() => {
		if (!activeCardExternalRefreshVersion) return
		if (!post) return
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
	const cardCount = post?.cards.length ?? 0
	const {
		bind,
		dragOffset,
		index: currentIndex,
		goTo,
		next,
		prev,
	} = useCarousel<HTMLDivElement>({
		total: cardCount,
		initialIndex: cardIndex,
		enableDrag: false,
		enableWheel: false,
	})

	// 水平方向滑动切换卡片；垂直方向透传给外层容器做页面滚动
	// 必须用原生 addEventListener({ passive: false }) 才能调用 preventDefault()
	const wheelAccumRef = useRef(0)
	const nextRef = useRef(next)
	const prevRef = useRef(prev)
	nextRef.current = next
	prevRef.current = prev

	useLayoutEffect(() => {
		const el = bind.ref.current
		if (!el || cardCount <= 1) return
		const handler = (event: WheelEvent) => {
			const absX = Math.abs(event.deltaX)
			const absY = Math.abs(event.deltaY)
			if (absX <= absY) return // 垂直主导 — 透传，让外层滚动
			event.preventDefault()
			event.stopPropagation()
			wheelAccumRef.current += event.deltaX
			if (wheelAccumRef.current >= 80) {
				wheelAccumRef.current -= 80
				nextRef.current()
			} else if (wheelAccumRef.current <= -80) {
				wheelAccumRef.current += 80
				prevRef.current()
			}
		}
		el.addEventListener("wheel", handler, { passive: false })
		return () => el.removeEventListener("wheel", handler)
	}, [bind.ref, cardCount])

	useEffect(() => {
		if (currentIndex !== cardIndex) {
			onChangeCard(currentIndex)
		}
	}, [cardIndex, currentIndex, onChangeCard])

	if (!post) return null
	const showNavigation = post.cards.length > 1

	return (
		<div
			ref={detailRootRef}
			className="scrollbar-hide h-full overflow-y-auto overscroll-contain bg-white"
			onWheel={handleDetailWheel}
			data-testid="red-detail-root"
		>
			<div className="min-h-full">
				<RednoteDetailHeader post={post} onBackHome={onBackHome} backLabel={backLabel} />
				<div
					ref={bind.ref}
					className="group relative aspect-[393/526] overflow-hidden bg-white shadow-sm"
					data-testid="red-detail-stage"
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
								data-testid={`red-detail-card-${c}`}
							>
								<CardFrame
									cardId={`red-detail-${post.meta.id}-${c}-${cardRefreshVersions[c] ?? 0}`}
									fileId={card.fileId}
									version={card.version}
									attachmentList={attachmentList}
									className="h-full w-full"
									imageProcessOptions={CARD_IMAGE_PROCESS}
									ref={(node) => {
										cardRefs.current[postIndex] =
											cardRefs.current[postIndex] || []
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
									"absolute bottom-1/2 left-3 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 shadow-sm transition-opacity",
									"group-hover:opacity-100",
									currentIndex === 0 && "pointer-events-none opacity-0",
								)}
								onPointerDown={handleControlPointerDown}
								onClick={prev}
								data-testid="red-detail-prev-button"
								aria-label="Previous card"
							>
								<ChevronLeft className="h-4 w-4" />
							</button>
							<button
								type="button"
								className={cn(
									"absolute bottom-1/2 right-3 z-10 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white opacity-0 shadow-sm transition-opacity",
									"group-hover:opacity-100",
									currentIndex >= post.cards.length - 1 &&
										"pointer-events-none opacity-0",
								)}
								onPointerDown={handleControlPointerDown}
								onClick={next}
								data-testid="red-detail-next-button"
								aria-label="Next card"
							>
								<ChevronRight className="h-4 w-4" />
							</button>
						</>
					) : null}
				</div>
				<div className="flex justify-center gap-1.5 py-3">
					{post.cards.map((_, idx) => (
						<button
							key={idx}
							type="button"
							onPointerDown={handleControlPointerDown}
							onClick={() => goTo(idx)}
							className={cn(
								"h-1.5 rounded-full transition-all",
								idx === currentIndex
									? "w-4 bg-[var(--red-brand)]"
									: "w-1.5 bg-black/30",
							)}
							style={{ "--red-brand": rednoteTokens.brand } as React.CSSProperties}
							data-testid={`red-detail-dot-${idx}`}
						/>
					))}
				</div>
				<RednoteDetailContent post={post} />
				<RednoteComments post={post} />
			</div>
		</div>
	)
})

function RednoteComments({ post }: { post: SelfMediaPost }) {
	const { t } = useTranslation("super")
	const comments = post.meta.comments || []
	if (!comments.length) return null

	return (
		<div className="p-3 text-[12px] shadow-sm" data-testid="red-detail-comments">
			<div className="mb-2 text-[13px] font-semibold text-black">
				{t("detail.selfMedia.platform.rednote.commentsTotal", {
					count: Number(post.meta.commentCount || comments.length),
				})}
			</div>
			<div className="space-y-3">
				{comments.map((comment, idx) => (
					<div key={idx} className="flex gap-2">
						<div
							className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white"
							style={{ background: comment.avatarColor || rednoteTokens.brand }}
						>
							{comment.avatarChar ||
								comment.name?.[0] ||
								t("detail.selfMedia.common.unknownAuthor")[0]}
						</div>
						<div className="flex-1">
							<div className="text-[11px] text-[#86909c]">
								{comment.name || t("detail.selfMedia.common.unknownAuthor")}
							</div>
							<div className="text-[12px] text-black/80">{comment.text}</div>
							<div className="mt-0.5 text-[10px] text-[#86909c]">
								{comment.time} · {comment.location} · ♥ {comment.likes}
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

export const RednoteScrollView = observer(function RednoteScrollView({
	attachmentList,
	allowEdit,
	cardRefs,
	postIndex,
	onAddCardToCurrentChat,
	onAddActivePostDirectoryToCurrentChat,
}: ScrollViewProps) {
	const store = useSelfMediaStore()
	const { activePost: post } = store
	const [cardRefreshVersions, setCardRefreshVersions] = useState<Record<number, number>>({})

	if (!post) return null
	const showPostFolderAction = Boolean(onAddActivePostDirectoryToCurrentChat)

	return (
		<div className="scrollbar-hide h-full overflow-y-auto" data-testid="red-scroll-view">
			<div className="space-y-3 p-3">
				{post.cards.map((card, c) => (
					<div
						key={`${card.fileId || card.path || c}_${card.version ?? ""}`}
						className="flex items-start gap-1"
					>
						<div
							className="min-w-0 flex-1 overflow-hidden border border-black/5 shadow-sm"
							data-testid={`red-scroll-card-${c}`}
						>
							<CardFrame
								cardId={`red-scroll-${post.meta.id}-${c}-${cardRefreshVersions[c] ?? 0}`}
								fileId={card.fileId}
								version={card.version}
								attachmentList={attachmentList}
								className=""
								autoHeight
								imageProcessOptions={CARD_IMAGE_PROCESS}
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
							onAddPostFolderToCurrentChat={
								showPostFolderAction
									? onAddActivePostDirectoryToCurrentChat
									: undefined
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
							fileId={card.fileId}
							attachmentList={attachmentList}
							testIdPrefix={`red-scroll-card-${c}`}
						/>
					</div>
				))}
			</div>
		</div>
	)
})

export function RednoteFooter({
	labels,
}: {
	labels: {
		home: string
		shopping: string
		publish: string
		messages: string
		me: string
	}
}) {
	return (
		<div className="flex h-12 select-none items-center justify-around border-t border-black/5 bg-white text-[11px] text-black/70">
			<span className="text-[16px] font-semibold text-black">{labels.home}</span>
			<span className="text-[16px]">{labels.shopping}</span>
			<span
				className="flex h-8 w-10 items-center justify-center rounded-md text-[12px] text-white"
				style={{ background: rednoteTokens.brand }}
			>
				<PlusIcon className="size-5" strokeWidth={2} />
			</span>
			<span className="text-[16px]">{labels.messages}</span>
			<span className="text-[16px]">{labels.me}</span>
		</div>
	)
}
