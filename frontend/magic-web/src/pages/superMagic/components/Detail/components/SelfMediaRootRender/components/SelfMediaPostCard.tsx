import { type CSSProperties, useCallback, useEffect, useState } from "react"
import { BarChart3, ClipboardCheck, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import { ScheduledTask } from "@/types/scheduledTask"
import type { SelfMediaPlatform } from "../../../types"
import type {
	SelfMediaPostOpsMetricsPayload,
	SelfMediaPostOpsSourcePayload,
} from "../services/SelfMediaFileStorageService"
import type {
	SelfMediaPostOpsArtifactAnimations,
	SelfMediaPostOpsArtifacts,
} from "../services/selfMediaOpsArtifactStates"
import { deriveOpsArtifacts } from "../services/selfMediaPostOpsEvidence"
import { isCardPlatform } from "../services/selfMediaAiNormalize"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import type { SelfMediaAttachmentNode, SelfMediaPostPublishStatus } from "../types"
import { useMeasuredContainerWidth } from "../hooks/useMeasuredContainerWidth"
import SelfMediaPostActionButton from "./SelfMediaPostActionButton"
import SelfMediaPostArticlePreview from "./SelfMediaPostArticlePreview"
import SelfMediaPostArtifactConfetti from "./SelfMediaPostArtifactConfetti"
import SelfMediaPostDataPopover from "./SelfMediaPostDataPopover"
import SelfMediaPostLifecycleStatus from "./SelfMediaPostLifecycleStatus"
import SelfMediaPostContextMenu from "./SelfMediaPostContextMenu"
import SelfMediaPostPublishedLinkPopover from "./SelfMediaPostPublishedLinkPopover"
import { getEngagementItems, getOpsArtifactItems } from "./SelfMediaPostCard.helpers"

const COMPACT_ACTION_LABEL_MIN_WIDTH = 320

export interface SelfMediaPostOpenTransitionPayload {
	rect: {
		left: number
		top: number
		width: number
		height: number
	}
	title: string
	subtitle: string
	postId: string
}

interface SelfMediaPostCardProps {
	item: SelfMediaPlatformPostItem
	title: string
	subtitle: string
	postId: string
	opsArtifacts: SelfMediaPostOpsArtifacts
	publishedUrl?: string
	opsArtifactAnimations?: SelfMediaPostOpsArtifactAnimations
	opsMetrics?: SelfMediaPostOpsMetricsPayload | null
	attachmentList?: SelfMediaAttachmentNode[]
	opening?: boolean
	openingDimmed?: boolean
	openingStyle?: CSSProperties
	onOpenPost: (
		target: { platform: SelfMediaPlatform; index: number },
		transition?: SelfMediaPostOpenTransitionPayload,
	) => void
	onRequestPrePublishAnalysis?: (target: { platform: SelfMediaPlatform; index: number }) => void
	onPostPublishRefresh?: (
		target: SelfMediaPlatformPostItem,
		publishedUrl?: string,
	) => Promise<void> | void
	onConfigureAutoSync?: (
		target: SelfMediaPlatformPostItem,
		config: { enabled: boolean; timeConfig: ScheduledTask.TimeConfig },
	) => Promise<boolean | void> | boolean | void
	onOpenOpsReview?: (target: SelfMediaPlatformPostItem) => void
	onLoadPublishedUrl?: (
		target: SelfMediaPlatformPostItem,
	) => Promise<string | undefined> | string | undefined
	onLoadOpsSource?: (
		target: SelfMediaPlatformPostItem,
	) => Promise<SelfMediaPostOpsSourcePayload | null> | SelfMediaPostOpsSourcePayload | null
	onBindPublishedUrl?: (
		target: SelfMediaPlatformPostItem,
		publishedUrl: string,
	) => Promise<boolean | void> | boolean | void
	onRenamePost?: (
		target: SelfMediaPlatformPostItem,
		nextTitle: string,
	) => Promise<boolean | void> | boolean | void
	onDeletePost?: (target: SelfMediaPlatformPostItem) => Promise<boolean | void> | boolean | void
	onMentionPost?: (target: SelfMediaPlatformPostItem) => void
	onSharePost?: (target: SelfMediaPlatformPostItem) => void
	onSetPostPublishStatus?: (
		target: SelfMediaPlatformPostItem,
		publishStatus?: SelfMediaPostPublishStatus,
	) => Promise<boolean | void> | boolean | void
	publishedLinkAutoOpenSignal?: number
}

function SelfMediaPostCard({
	item,
	title,
	subtitle,
	postId,
	opsArtifacts,
	publishedUrl,
	opsArtifactAnimations,
	opsMetrics,
	attachmentList,
	opening,
	openingDimmed,
	openingStyle,
	onOpenPost,
	onRequestPrePublishAnalysis,
	onPostPublishRefresh,
	onConfigureAutoSync,
	onOpenOpsReview,
	onLoadPublishedUrl,
	onLoadOpsSource,
	onBindPublishedUrl,
	onRenamePost,
	onDeletePost,
	onMentionPost,
	onSharePost,
	onSetPostPublishStatus,
	publishedLinkAutoOpenSignal,
}: SelfMediaPostCardProps) {
	const { t, i18n } = useTranslation("super")
	const { platform, index } = item
	const engagementItems = getEngagementItems(opsMetrics, i18n?.language)
	const { containerRef: cardRef, width: cardWidth } = useMeasuredContainerWidth<HTMLDivElement>()
	const normalizedPublishedUrl = publishedUrl?.trim() || ""
	const [localPublishedUrl, setLocalPublishedUrl] = useState(normalizedPublishedUrl)
	const publishStatus = item.entry.publishStatus || item.post.meta.publishStatus
	const displayedOpsArtifacts = deriveOpsArtifacts(opsArtifacts, opsMetrics, localPublishedUrl)
	const sourceReady = displayedOpsArtifacts.source
	const canManagePublishedUrl = Boolean(onBindPublishedUrl || onLoadPublishedUrl)
	const canOpenDataPopover = Boolean(
		onPostPublishRefresh || onConfigureAutoSync || onLoadOpsSource,
	)
	const isCardComfortable = cardWidth > COMPACT_ACTION_LABEL_MIN_WIDTH
	const shouldShowActionLabels = cardWidth === 0 || isCardComfortable
	const handleOpenPost = useCallback(() => {
		const rect = cardRef.current?.getBoundingClientRect()
		const canAnimateFromCard = Boolean(rect && rect.width > 0 && rect.height > 0)
		onOpenPost(
			{ platform, index },
			canAnimateFromCard && rect
				? {
						rect: {
							left: rect.left,
							top: rect.top,
							width: rect.width,
							height: rect.height,
						},
						title,
						subtitle,
						postId,
					}
				: undefined,
		)
	}, [cardRef, index, onOpenPost, platform, postId, subtitle, title])

	useEffect(() => {
		if (!publishedLinkAutoOpenSignal) return
		cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
	}, [cardRef, publishedLinkAutoOpenSignal])

	useEffect(() => {
		if (normalizedPublishedUrl) setLocalPublishedUrl(normalizedPublishedUrl)
	}, [normalizedPublishedUrl])

	const opsArtifactControls = (
		<div
			className="self-media-post-card-artifacts pointer-events-auto relative z-20 mt-3 flex items-center gap-2"
			data-testid={`self-media-home-post-ops-artifacts-${postId}`}
		>
			{getOpsArtifactItems(displayedOpsArtifacts).map((artifact) =>
				artifact.key === "source" && canManagePublishedUrl ? (
					<SelfMediaPostPublishedLinkPopover
						key={artifact.key}
						item={item}
						postId={postId}
						sourceReady={sourceReady}
						trigger="artifact"
						artifactReady={artifact.ready}
						artifactReadyClassName={artifact.readyClassName}
						animation={opsArtifactAnimations?.[artifact.key]}
						localPublishedUrl={localPublishedUrl}
						onLocalPublishedUrlChange={setLocalPublishedUrl}
						onLoadPublishedUrl={onLoadPublishedUrl}
						onBindPublishedUrl={onBindPublishedUrl}
						onPostPublishRefresh={onPostPublishRefresh}
					/>
				) : (
					<MagicTooltip key={artifact.key} title={t(artifact.labelKey)}>
						<span
							className={cn(
								"relative flex h-6 w-6 items-center justify-center rounded-full transition-colors",
								artifact.ready
									? artifact.readyClassName
									: "bg-[#f4f4f5] text-[#71717a]/60",
								opsArtifactAnimations?.[artifact.key] === "updated" &&
									"animate-bounce",
							)}
							aria-label={t(artifact.labelKey)}
							data-animation={opsArtifactAnimations?.[artifact.key]}
							data-ready={artifact.ready ? "true" : "false"}
							data-testid={`self-media-home-post-ops-artifact-${postId}-${artifact.key}`}
						>
							{opsArtifactAnimations?.[artifact.key] === "created" ? (
								<SelfMediaPostArtifactConfetti
									postId={postId}
									artifactKey={artifact.key}
								/>
							) : null}
							<artifact.Icon className="size-3.5" aria-hidden="true" />
						</span>
					</MagicTooltip>
				),
			)}
		</div>
	)

	const canOpenContextMenu = Boolean(
		onRenamePost || onDeletePost || onMentionPost || onSharePost || onSetPostPublishStatus,
	)
	const renderCardContent = (openContextMenu: (anchor: HTMLElement) => void) => (
		<div
			ref={cardRef}
			className={cn(
				"relative h-full",
				opening && "self-media-post-card-opening",
				openingDimmed && "self-media-post-card-dimmed",
			)}
			style={openingStyle}
			data-card-layout={isCardComfortable ? "comfortable" : "compact"}
			data-publish-status={publishStatus}
			data-testid={`self-media-home-post-card-${postId}`}
		>
			<div
				className={cn(
					"self-media-post-card-button group relative isolate flex h-full min-h-[168px] w-full flex-col gap-3 rounded-[22px] bg-[#ffffff] p-4 pb-[80px] text-left shadow-[inset_0_1px_rgba(255,255,255,0.75),0_10px_30px_rgba(47,43,36,0.06)] transition-transform hover:-translate-y-0.5",
					isCardComfortable && "min-h-[192px] rounded-[24px] p-[20px] pb-[80px]",
				)}
			>
				<button
					type="button"
					className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					onClick={handleOpenPost}
					aria-label={title}
					data-testid={`self-media-home-post-open-${postId}`}
				/>
				<div className="pointer-events-none relative z-10 flex items-start gap-4">
					<div
						className={cn(
							"self-media-post-card-preview flex shrink-0 items-center justify-center overflow-hidden bg-[#f4f4f5] text-[#71717a]",
							"rounded-[16px]",
							isCardPlatform(platform) ? "h-[5.5rem] w-[4.125rem]" : "h-16 w-16",
						)}
					>
						<SelfMediaPostArticlePreview
							item={item}
							attachmentList={attachmentList}
							postId={postId}
						/>
					</div>
					<div
						className={cn(
							"self-media-post-card-copy min-w-0 flex-1 space-y-1 pt-0.5",
							isCardComfortable && "space-y-1.5 pt-1",
						)}
					>
						<div className="flex min-w-0 items-start gap-2">
							<h3 className="line-clamp-2 min-w-0 flex-1 text-[15px] font-[760] leading-[1.35] text-[#18181b]">
								{title}
							</h3>
							<SelfMediaPostLifecycleStatus
								opsArtifacts={displayedOpsArtifacts}
								postId={postId}
								publishStatus={publishStatus}
							/>
						</div>
						{subtitle ? (
							<p className="line-clamp-2 text-[12px] leading-[1.6] text-[#71717a]">
								{subtitle}
							</p>
						) : null}
						{opsArtifactControls}
					</div>
				</div>
				{engagementItems.length > 0 ? (
					<div
						className={cn(
							"self-media-post-card-engagement pointer-events-none relative z-10 flex min-h-5 flex-nowrap items-center gap-x-3 overflow-hidden whitespace-nowrap pt-1 text-[12px] font-[500] text-[#71717a]",
							isCardComfortable && "gap-x-4",
						)}
						data-testid={`self-media-home-post-engagement-${postId}`}
					>
						{engagementItems.map((metric) => (
							<span
								key={metric.key}
								className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
							>
								<metric.Icon className="h-3.5 w-3.5 shrink-0" />
								<span>
									{t(metric.labelKey)} {metric.value}
								</span>
							</span>
						))}
					</div>
				) : null}
				<div
					className="self-media-post-card-actions pointer-events-auto absolute bottom-4 left-4 right-4 z-20 flex min-w-0 max-w-none flex-wrap items-center justify-end gap-1.5"
					data-label-mode={shouldShowActionLabels ? "expanded" : "compact"}
					data-testid={`self-media-home-post-actions-${postId}`}
				>
					{onRequestPrePublishAnalysis ? (
						<SelfMediaPostActionButton
							label={t("detail.selfMedia.analysis.action")}
							Icon={ClipboardCheck}
							showLabel={shouldShowActionLabels}
							onClick={() => onRequestPrePublishAnalysis({ platform, index })}
							dataTestId={`self-media-home-post-analysis-${postId}`}
						/>
					) : null}
					{!sourceReady && canManagePublishedUrl ? (
						<SelfMediaPostPublishedLinkPopover
							item={item}
							postId={postId}
							sourceReady={sourceReady}
							trigger="action"
							showLabel={shouldShowActionLabels}
							localPublishedUrl={localPublishedUrl}
							onLocalPublishedUrlChange={setLocalPublishedUrl}
							onLoadPublishedUrl={onLoadPublishedUrl}
							onBindPublishedUrl={onBindPublishedUrl}
							onPostPublishRefresh={onPostPublishRefresh}
							autoOpenSignal={publishedLinkAutoOpenSignal}
						/>
					) : null}
					{sourceReady && canOpenDataPopover ? (
						<SelfMediaPostDataPopover
							item={item}
							postId={postId}
							label={t("detail.selfMedia.home.dataSyncNow")}
							showLabel={shouldShowActionLabels}
							publishedUrl={localPublishedUrl}
							onPostPublishRefresh={onPostPublishRefresh}
							onConfigureAutoSync={onConfigureAutoSync}
							onLoadOpsSource={onLoadOpsSource}
						/>
					) : null}
					{sourceReady && onOpenOpsReview ? (
						<SelfMediaPostActionButton
							label={t("detail.selfMedia.home.openOpsReview")}
							Icon={BarChart3}
							showLabel={shouldShowActionLabels}
							variant="primary"
							onClick={() => onOpenOpsReview(item)}
							dataTestId={`self-media-home-post-review-card-${postId}`}
						/>
					) : null}
					{canOpenContextMenu ? (
						<SelfMediaPostActionButton
							label={t("detail.selfMedia.home.moreActions")}
							Icon={MoreHorizontal}
							showLabel={false}
							onClick={(event) => openContextMenu(event.currentTarget)}
							dataTestId={`self-media-home-post-more-${postId}`}
						/>
					) : null}
				</div>
			</div>
		</div>
	)

	return (
		<SelfMediaPostContextMenu
			item={item}
			title={title}
			onRenamePost={onRenamePost}
			onDeletePost={onDeletePost}
			onMentionPost={onMentionPost}
			onSharePost={onSharePost}
			onSetPostPublishStatus={onSetPostPublishStatus}
			t={t}
		>
			{renderCardContent}
		</SelfMediaPostContextMenu>
	)
}

export default SelfMediaPostCard
