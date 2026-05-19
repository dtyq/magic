import { memo, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import type { ImageProcessOptions } from "@/utils/image-processing"
import type { PlatformComponentProps, SelfMediaPost } from "../../types"
import { useCoverImageUrl } from "./useCoverImageUrl"
import { wechatOfficialTokens } from "./tokens"

/** Hero cover: up to 800px wide, webp, quality 85 */
const HERO_IMAGE_PROCESS: ImageProcessOptions = {
	resize: { w: 800, m: "lfit" },
	quality: 85,
	format: "webp",
}

/** Thumbnail cover: 144×144 (2× retina for 72px display), webp, quality 80 */
const THUMBNAIL_IMAGE_PROCESS: ImageProcessOptions = {
	resize: { w: 144, h: 144, m: "fill" },
	quality: 80,
	format: "webp",
}

interface EnsurePostLoaded {
	(index: number): Promise<SelfMediaPost | null>
}

interface WechatCoverViewProps {
	posts: SelfMediaPost[]
	attachmentList?: PlatformComponentProps["attachmentList"]
	onSelectPost: (idx: number) => void
	onEnsurePostLoaded?: EnsurePostLoaded
}

interface WechatCoverCardProps {
	post: SelfMediaPost
	postIndex: number
	onSelectPost: (idx: number) => void
	onEnsurePostLoaded?: EnsurePostLoaded
	scrollRootRef: React.RefObject<HTMLDivElement | null>
}

function WechatCoverPostSkeleton({ postId }: { postId: string }) {
	return (
		<div data-testid={`wechat-cover-post-loading-${postId}`}>
			<div className="aspect-[16/9] w-full animate-pulse bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a]" />
			<div className="flex items-stretch gap-3 px-3 py-3">
				<div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
					<div className="h-4 w-full animate-pulse rounded bg-[#f1f2f4]" />
					<div className="h-4 w-3/4 animate-pulse rounded bg-[#f1f2f4]" />
				</div>
				<div className="h-[72px] w-[72px] flex-shrink-0 animate-pulse rounded-sm bg-[#f1f2f4]" />
			</div>
		</div>
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
		rect.bottom > topBoundary - 320 &&
		rect.top < bottomBoundary + 320 &&
		rect.right > leftBoundary &&
		rect.left < rightBoundary
	)
}

function useLazyInView(scrollRootRef: React.RefObject<HTMLDivElement | null>) {
	const ref = useRef<HTMLDivElement | null>(null)
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		const node = ref.current
		if (!node || visible) return
		const scrollRoot = scrollRootRef.current
		if (isElementVisibleInRoot(node, scrollRoot)) {
			setVisible(true)
			return
		}
		if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") {
			setVisible(true)
			return
		}

		const observer = new window.IntersectionObserver(
			(entries) => {
				const entry = entries[0]
				if (!entry?.isIntersecting) return
				setVisible(true)
				observer.disconnect()
			},
			{ root: scrollRoot, rootMargin: "320px 0px", threshold: 0.01 },
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [scrollRootRef, visible])

	return { ref, visible }
}

function HeroImage({
	fileId,
	enabled,
	feedTitle,
}: {
	fileId?: string
	enabled: boolean
	feedTitle?: string
}) {
	const { url, loading } = useCoverImageUrl(
		fileId,
		enabled && Boolean(fileId),
		HERO_IMAGE_PROCESS,
	)

	return (
		<div className="relative aspect-[16/9] w-full overflow-hidden bg-[#1f1f1f]">
			{url ? (
				<img
					src={url}
					alt={feedTitle || ""}
					className="h-full w-full object-cover"
					draggable={false}
				/>
			) : (
				<div
					className={cn(
						"h-full w-full bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a]",
						loading && "animate-pulse",
					)}
				/>
			)}
			{feedTitle ? (
				<div
					className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-4 pb-3 pt-10"
					data-testid="wechat-cover-hero-title-overlay"
				>
					<div className="line-clamp-2 text-[16px] font-semibold leading-[22px] text-white drop-shadow-sm">
						{feedTitle}
					</div>
				</div>
			) : null}
		</div>
	)
}

function ThumbnailImage({ fileId, enabled }: { fileId?: string; enabled: boolean }) {
	const { url, loading } = useCoverImageUrl(
		fileId,
		enabled && Boolean(fileId),
		THUMBNAIL_IMAGE_PROCESS,
	)

	if (!fileId) {
		return (
			<div
				className="aspect-square w-[72px] flex-shrink-0 rounded-sm bg-[#f0f0f0]"
				data-testid="wechat-cover-thumb-empty"
			/>
		)
	}
	return (
		<div className="aspect-square w-[72px] flex-shrink-0 overflow-hidden rounded-sm bg-[#f0f0f0]">
			{url ? (
				<img src={url} alt="" className="h-full w-full object-cover" draggable={false} />
			) : (
				<div
					className={cn(
						"h-full w-full bg-gradient-to-b from-[#f5f5f5] to-[#e4e4e4]",
						loading && "animate-pulse",
					)}
				/>
			)}
		</div>
	)
}

function AccountHeader({ post }: { post: SelfMediaPost }) {
	const { t } = useTranslation("super")
	const author = (post.meta.author || "").replace(/^@+/, "")
	const displayName = author || t("detail.selfMedia.common.unknownAuthor")
	const initial = displayName.charAt(0) || t("detail.selfMedia.common.unknownAuthor").charAt(0)
	const timeText =
		(post.meta as Record<string, unknown>).time ??
		t("detail.selfMedia.platform.wechat-official-accounts.cover.timeHint")

	return (
		<div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
			<div
				className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[6px] text-[13px] font-semibold text-white"
				style={{ background: wechatOfficialTokens.brand }}
				aria-hidden
			>
				{initial}
			</div>
			<div className="min-w-0 flex-1 truncate text-[14px] font-medium text-black">
				{displayName}
			</div>
			<span className="flex-shrink-0 text-[12px] text-[#9ba0a6]">{String(timeText)}</span>
		</div>
	)
}

function WechatCoverCard({
	post,
	postIndex,
	onSelectPost,
	onEnsurePostLoaded,
	scrollRootRef,
}: WechatCoverCardProps) {
	const { t } = useTranslation("super")
	const { ref, visible } = useLazyInView(scrollRootRef)
	const requestedRef = useRef(false)
	const [postLoading, setPostLoading] = useState(false)
	const feedTitle = post.meta.feedTitle || post.meta.title || ""
	const subtitle = post.meta.subtitle
	const hero = post.heroCover
	const thumb = post.thumbnailCover
	const fallbackToThumb = !hero?.fileId && Boolean(thumb?.fileId)
	const heroFileId = hero?.fileId || (fallbackToThumb ? thumb?.fileId : undefined)
	const hasResolvedAsset = Boolean(
		post.heroCover?.fileId || post.thumbnailCover?.fileId || post.article?.fileId,
	)
	const isPostLoading = postLoading && !hasResolvedAsset

	useEffect(() => {
		if (!hasResolvedAsset) return
		setPostLoading(false)
	}, [hasResolvedAsset])

	useEffect(() => {
		let cancelled = false
		if (!visible || requestedRef.current || !onEnsurePostLoaded) return
		if (post.heroCover?.fileId || post.thumbnailCover?.fileId || post.article?.fileId) return
		requestedRef.current = true
		setPostLoading(true)
		void onEnsurePostLoaded(postIndex).finally(() => {
			if (cancelled) return
			setPostLoading(false)
		})
		return () => {
			cancelled = true
		}
	}, [
		visible,
		onEnsurePostLoaded,
		post.heroCover?.fileId,
		post.thumbnailCover?.fileId,
		post.article?.fileId,
		postIndex,
	])

	const handleOpen = () => onSelectPost(postIndex)

	const thumbTitle = post.meta.title || feedTitle || t("detail.selfMedia.common.untitledPost")

	return (
		<div
			ref={ref}
			className="mb-2 w-full overflow-hidden bg-white"
			data-testid={`wechat-cover-card-${post.meta.id}`}
		>
			<AccountHeader post={post} />

			{isPostLoading ? (
				<WechatCoverPostSkeleton postId={post.meta.id} />
			) : (
				<>
					<button
						type="button"
						className="block w-full text-left"
						onClick={handleOpen}
						data-testid={`wechat-cover-hero-${post.meta.id}`}
					>
						<HeroImage fileId={heroFileId} enabled={visible} feedTitle={feedTitle} />
					</button>

					<button
						type="button"
						className="flex w-full items-stretch gap-3 px-3 py-3 text-left active:bg-black/[0.03]"
						onClick={handleOpen}
						data-testid={`wechat-cover-thumb-row-${post.meta.id}`}
					>
						<div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
							<div className="line-clamp-2 text-[15px] font-normal leading-[21px] text-[#1a1a1a]">
								{thumbTitle}
							</div>
							{subtitle ? (
								<div className="line-clamp-1 text-[12px] leading-4 text-[#9ba0a6]">
									{subtitle}
								</div>
							) : null}
						</div>
						<ThumbnailImage fileId={thumb?.fileId} enabled={visible} />
					</button>
				</>
			)}
		</div>
	)
}

function WechatCoverView({ posts, onSelectPost, onEnsurePostLoaded }: WechatCoverViewProps) {
	const scrollRootRef = useRef<HTMLDivElement>(null)

	return (
		<div
			ref={scrollRootRef}
			className="scrollbar-hide h-full w-full overflow-y-auto pb-6"
			style={{ background: wechatOfficialTokens.background }}
			data-testid="wechat-cover-view"
		>
			<div className="w-full pt-2">
				{posts.map((post, idx) => (
					<WechatCoverCard
						key={post.meta.id || idx}
						post={post}
						postIndex={idx}
						onSelectPost={onSelectPost}
						onEnsurePostLoaded={onEnsurePostLoaded}
						scrollRootRef={scrollRootRef}
					/>
				))}
			</div>
		</div>
	)
}

export default memo(WechatCoverView)
