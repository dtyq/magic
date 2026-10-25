import { Layers } from "lucide-react"
import { cn } from "@/utils/cn"
import type { ScheduledTask } from "@/types/scheduledTask"
import type { SelfMediaPlatform } from "../../../types"
import type { SelfMediaAttachmentNode, SelfMediaPostPublishStatus } from "../types"
import type {
	SelfMediaPostOpsMetricsPayload,
	SelfMediaPostOpsSourcePayload,
} from "../services/SelfMediaFileStorageService"
import { getSelfMediaPostKey } from "../services/selfMediaOpsOverview"
import type {
	SelfMediaPostOpsArtifactAnimations,
	SelfMediaPostOpsArtifacts,
} from "../services/selfMediaOpsArtifactStates"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import { ALL_PLATFORMS } from "./SelfMediaInitPanel/types"
import type {
	SelfMediaHomeOpeningPost,
	SelfMediaHomePostGroup,
	SelfMediaHomeTranslate,
} from "./SelfMediaHomeTypes"
import SelfMediaPostCard, { type SelfMediaPostOpenTransitionPayload } from "./SelfMediaPostCard"
import PlatformBrandIcon from "./PlatformBrandIcon"

interface SelfMediaHomePostListProps {
	postGroups: SelfMediaHomePostGroup[]
	postCount: number
	attachmentList?: SelfMediaAttachmentNode[]
	openingPost: SelfMediaHomeOpeningPost | null
	opsArtifactsByPostKey: Map<string, SelfMediaPostOpsArtifacts>
	opsMetricsByPostKey: Map<string, SelfMediaPostOpsMetricsPayload | null>
	publishedUrlsByPostKey?: Map<string, string>
	opsArtifactAnimationsByPostKey: Map<string, SelfMediaPostOpsArtifactAnimations>
	publishedLinkAutoOpenTarget?: { postKey: string; signal: number } | null
	columnCount?: 1 | 2 | 3
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
	onOpenOpsReview: (target: SelfMediaPlatformPostItem) => void
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
	t: SelfMediaHomeTranslate
}

function SelfMediaHomePostList({
	postGroups,
	postCount,
	attachmentList,
	openingPost,
	opsArtifactsByPostKey,
	opsMetricsByPostKey,
	publishedUrlsByPostKey,
	opsArtifactAnimationsByPostKey,
	publishedLinkAutoOpenTarget,
	columnCount = 1,
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
	t,
}: SelfMediaHomePostListProps) {
	if (postGroups.length === 0) return null

	const getPlatformLabel = (platform: SelfMediaPlatform) => {
		const platformConfig = ALL_PLATFORMS.find((item) => item.value === platform)
		return platformConfig ? t(platformConfig.labelKey) : platform
	}

	return (
		<section
			className="self-media-home-enter-item space-y-5"
			style={{ animationDelay: "190ms" }}
			data-testid="self-media-home-post-list"
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm font-medium text-foreground">
					<Layers size={14} />
					<span>
						{t("detail.selfMedia.home.articleCount", {
							count: postCount,
						})}
					</span>
				</div>
			</div>
			<div className="space-y-8">
				{postGroups.map(({ platform, posts }) => (
					<section
						key={platform}
						className="space-y-4"
						data-testid={`self-media-home-platform-group-${platform}`}
					>
						<div className="flex items-center gap-2">
							<PlatformBrandIcon platform={platform} className="size-5 shrink-0" />
							<h3
								className={cn(
									"text-base font-semibold text-foreground",
									openingPost && "self-media-home-opening-dim",
								)}
							>
								{getPlatformLabel(platform)}
							</h3>
						</div>
						<div
							className={cn(
								"grid gap-4",
								columnCount === 2 && "grid-cols-2",
								columnCount === 3 && "grid-cols-3",
							)}
						>
							{posts.map((item) => {
								const { post, index } = item
								const postKey = getSelfMediaPostKey(item)
								const postId = post.meta.id || `${platform}-post-${index}`
								const title =
									post.meta.feedTitle ||
									post.meta.title ||
									t("detail.selfMedia.common.postFallbackTitle", {
										index: index + 1,
									})
								const subtitle = post.meta.subtitle || post.meta.author || ""
								const opsArtifacts = opsArtifactsByPostKey.get(postKey) ?? {
									source: false,
									metrics: false,
									comments: false,
									review: false,
								}
								const opsMetrics = opsMetricsByPostKey.get(postKey) ?? null
								const isOpening = openingPost?.postKey === postKey

								return (
									<SelfMediaPostCard
										key={`${platform}-${postId}`}
										item={item}
										title={title}
										subtitle={subtitle}
										postId={postId}
										opsArtifacts={opsArtifacts}
										publishedUrl={publishedUrlsByPostKey?.get(postKey)}
										opsArtifactAnimations={opsArtifactAnimationsByPostKey.get(
											postKey,
										)}
										publishedLinkAutoOpenSignal={
											publishedLinkAutoOpenTarget?.postKey === postKey
												? publishedLinkAutoOpenTarget.signal
												: undefined
										}
										opsMetrics={opsMetrics}
										attachmentList={attachmentList}
										opening={isOpening}
										openingDimmed={Boolean(openingPost) && !isOpening}
										openingStyle={isOpening ? openingPost?.style : undefined}
										onOpenPost={onOpenPost}
										onRequestPrePublishAnalysis={onRequestPrePublishAnalysis}
										onPostPublishRefresh={onPostPublishRefresh}
										onConfigureAutoSync={onConfigureAutoSync}
										onOpenOpsReview={onOpenOpsReview}
										onLoadPublishedUrl={onLoadPublishedUrl}
										onLoadOpsSource={onLoadOpsSource}
										onBindPublishedUrl={onBindPublishedUrl}
										onRenamePost={onRenamePost}
										onDeletePost={onDeletePost}
										onMentionPost={onMentionPost}
										onSharePost={onSharePost}
										onSetPostPublishStatus={onSetPostPublishStatus}
									/>
								)
							})}
						</div>
					</section>
				))}
			</div>
		</section>
	)
}

export default SelfMediaHomePostList
