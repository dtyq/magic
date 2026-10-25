import { type CSSProperties, useCallback, useMemo, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useUserInfo } from "@/models/user/hooks/useUserInfo"
import type { ScheduledTask } from "@/types/scheduledTask"
import type { SelfMediaPlatform } from "../../../types"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import type { AICardCreateInitialValues } from "./AICardCreateDialog"
import type { SelfMediaAttachmentNode, SelfMediaPostPublishStatus } from "../types"
import type { SelfMediaPostOpenTransitionPayload } from "./SelfMediaPostCard"
import type {
	SelfMediaPostOpsMetricsPayload,
	SelfMediaPostOpsSourcePayload,
} from "../services/SelfMediaFileStorageService"
import {
	buildOpsMetricsRequestSignature,
	buildPostOpsArtifactStates,
	getPostOpsArtifacts,
	type SelfMediaPostOpsArtifacts,
	type SelfMediaPostOpsArtifactStates,
} from "../services/selfMediaOpsArtifactStates"
import SelfMediaOpsReviewDashboard, {
	type SelfMediaOpsReviewData,
} from "./SelfMediaOpsReviewDashboard"
import SelfMediaOpsOverviewCard from "./SelfMediaOpsOverviewCard"
import {
	buildSelfMediaOpsOverview,
	getSelfMediaPostKey,
	type SelfMediaOpsOverviewAction,
} from "../services/selfMediaOpsOverview"
import { buildDisplayedSelfMediaPostOpsArtifactsByPostKey } from "../services/selfMediaPostOpsEvidence"
import { executeSelfMediaOpsOverviewAction } from "../services/selfMediaOpsOverviewActionRunner"
import SelfMediaHomeAICardList from "./SelfMediaHomeAICardList"
import SelfMediaHomeAnimations, {
	OPEN_POST_FALLBACK_TRANSITION_MS,
} from "./SelfMediaHomeAnimations"
import SelfMediaHomeEmptyState from "./SelfMediaHomeEmptyState"
import SelfMediaHomeHeader from "./SelfMediaHomeHeader"
import SelfMediaHomePostList from "./SelfMediaHomePostList"
import { SELF_MEDIA_WORKSPACE_BACKGROUND_STYLE } from "./SelfMediaWorkspaceBackground"
import {
	buildOpsArtifactStateSignature,
	buildOpsReviewDataVersion,
	findSelfMediaFolderNode,
	getSelfMediaHomeLayout,
	getSelfMediaHomeDisplayName,
	getSelfMediaHomePostColumnCount,
	getViewTransitionDocument,
	isAICardDisplayConfig,
	prefersReducedMotion,
} from "./SelfMediaHomePage.helpers"
import {
	useSelfMediaHomePageRuntime,
	type OpsArtifactAnimations,
	type OpsMetricsLoadState,
} from "./SelfMediaHomePage.hooks"
import { useSelfMediaHomeDailyInsight } from "../hooks/useSelfMediaHomeDailyInsight"
import { useSelfMediaOpsHealthInsight } from "../hooks/useSelfMediaOpsHealthInsight"
import { useMeasuredContainerWidth } from "../hooks/useMeasuredContainerWidth"
import { useSelfMediaPublishedUrlsByPostKey } from "../hooks/useSelfMediaPublishedUrlsByPostKey"
import { useSelfMediaHomeScrollPosition } from "../hooks/useSelfMediaHomeScrollPosition"
import {
	formatSelfMediaHomeWelcomeTitle,
	type SelfMediaHomeDailyInsightStorage,
} from "../services/selfMediaHomeInsight"
import type { SelfMediaOpsHealthInsightStorage } from "../services/selfMediaOpsHealthInsight"
import type {
	AICardFolderItem,
	SelfMediaHomeOpeningPost,
	SelfMediaHomePostGroup,
} from "./SelfMediaHomeTypes"

interface SelfMediaHomePageProps {
	posts: SelfMediaPlatformPostItem[]
	allowEdit?: boolean
	attachmentList?: SelfMediaAttachmentNode[]
	onEnsurePostLoaded?: (target: { platform: SelfMediaPlatform; index: number }) => void
	onCreateArticle?: () => void
	onOpenPost: (target: { platform: SelfMediaPlatform; index: number }) => void
	onRequestPrePublishAnalysis?: (target: { platform: SelfMediaPlatform; index: number }) => void
	onOpenOpsMetrics?: (target: SelfMediaPlatformPostItem) => void
	onPostPublishRefresh?: (
		target: SelfMediaPlatformPostItem,
		publishedUrl?: string,
	) => Promise<void> | void
	onConfigureAutoSync?: (
		target: SelfMediaPlatformPostItem,
		config: { enabled: boolean; timeConfig: ScheduledTask.TimeConfig },
	) => Promise<boolean | void> | boolean | void
	onLoadOpsReviewData?: (target: SelfMediaPlatformPostItem) => Promise<SelfMediaOpsReviewData>
	onLoadOpsMetrics?: (
		target: SelfMediaPlatformPostItem,
	) => Promise<SelfMediaPostOpsMetricsPayload | null> | SelfMediaPostOpsMetricsPayload | null
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
	onOpenBrandConfig?: () => void
	onRefreshAllData?: () => void
	onCreateAICard?: (initialValues?: AICardCreateInitialValues) => void
	onOpenAICardFolder?: (folder: AICardFolderItem) => void
	homeDailyInsightStorage?: SelfMediaHomeDailyInsightStorage
	opsHealthInsightStorage?: SelfMediaOpsHealthInsightStorage
	homeDailyInsightModelId?: string
	initialScrollTop?: number
	onScrollTopChange?: (scrollTop: number) => void
	folderFileId?: string
	className?: string
}

function SelfMediaHomePage({
	posts,
	allowEdit = true,
	attachmentList,
	onEnsurePostLoaded,
	onCreateArticle,
	onOpenPost,
	onRequestPrePublishAnalysis,
	onOpenOpsMetrics,
	onPostPublishRefresh,
	onConfigureAutoSync,
	onLoadOpsReviewData,
	onLoadOpsMetrics,
	onLoadPublishedUrl,
	onLoadOpsSource,
	onBindPublishedUrl,
	onRenamePost,
	onDeletePost,
	onMentionPost,
	onSharePost,
	onSetPostPublishStatus,
	onOpenBrandConfig,
	onRefreshAllData,
	onCreateAICard,
	onOpenAICardFolder,
	homeDailyInsightStorage,
	opsHealthInsightStorage,
	homeDailyInsightModelId,
	initialScrollTop,
	onScrollTopChange,
	folderFileId,
	className,
}: SelfMediaHomePageProps) {
	const { t } = useTranslation("super")
	const { userInfo } = useUserInfo()
	const requestedPreviewPostKeysRef = useRef(new Set<string>())
	const requestedOpsMetricsPostKeysRef = useRef(new Map<string, string>())
	const isHomePageMountedRef = useRef(false)
	const currentOpsArtifactStatesRef = useRef(new Map<string, SelfMediaPostOpsArtifactStates>())
	const previousOpsArtifactStatesRef = useRef(new Map<string, SelfMediaPostOpsArtifactStates>())
	const openPostTransitionTimerRef = useRef<number | null>(null)
	const { containerRef: homeContainerRef, width: homeContainerWidth } =
		useMeasuredContainerWidth<HTMLDivElement>()
	const homeScrollViewportRef = useSelfMediaHomeScrollPosition({
		initialScrollTop,
		onScrollTopChange,
	})
	const [activeOpsReviewTarget, setActiveOpsReviewTarget] =
		useState<SelfMediaPlatformPostItem | null>(null)
	const [openingPost, setOpeningPost] = useState<SelfMediaHomeOpeningPost | null>(null)
	const [opsMetricsByPostKey, setOpsMetricsByPostKey] = useState(
		() => new Map<string, SelfMediaPostOpsMetricsPayload | null>(),
	)
	const [opsMetricsLoadStateByPostKey, setOpsMetricsLoadStateByPostKey] = useState(
		() => new Map<string, OpsMetricsLoadState>(),
	)
	const [opsArtifactAnimationsByPostKey, setOpsArtifactAnimationsByPostKey] = useState(
		() => new Map<string, OpsArtifactAnimations>(),
	)
	const [publishedLinkAutoOpenTarget, setPublishedLinkAutoOpenTarget] = useState<{
		postKey: string
		signal: number
	} | null>(null)
	const hasPosts = posts.length > 0
	const postGroups = posts.reduce<SelfMediaHomePostGroup[]>((groups, item) => {
		const group = groups.find((candidate) => candidate.platform === item.platform)
		if (group) {
			group.posts.push(item)
		} else {
			groups.push({ platform: item.platform, posts: [item] })
		}
		return groups
	}, [])
	const opsArtifactStatesByPostKey = new Map<string, SelfMediaPostOpsArtifactStates>()
	posts.forEach((item) => {
		opsArtifactStatesByPostKey.set(
			getSelfMediaPostKey(item),
			buildPostOpsArtifactStates(item, attachmentList),
		)
	})
	currentOpsArtifactStatesRef.current = opsArtifactStatesByPostKey
	const opsArtifactStateSignature = buildOpsArtifactStateSignature(opsArtifactStatesByPostKey)
	const opsArtifactsByPostKey = new Map<string, SelfMediaPostOpsArtifacts>()
	opsArtifactStatesByPostKey.forEach((states, postKey) => {
		opsArtifactsByPostKey.set(postKey, getPostOpsArtifacts(states))
	})
	const publishedUrlsByPostKey = useSelfMediaPublishedUrlsByPostKey({
		posts,
		artifactsByPostKey: opsArtifactsByPostKey,
		opsArtifactStateSignature,
		onLoadPublishedUrl,
	})
	const displayedOpsArtifactsByPostKey = buildDisplayedSelfMediaPostOpsArtifactsByPostKey({
		artifactsByPostKey: opsArtifactsByPostKey,
		metricsByPostKey: opsMetricsByPostKey,
		publishedUrlsByPostKey,
	})
	const opsOverview = buildSelfMediaOpsOverview({
		posts,
		artifactsByPostKey: displayedOpsArtifactsByPostKey,
		metricsByPostKey: opsMetricsByPostKey,
	})
	const isOpsMetricsHydrating =
		Boolean(onLoadOpsMetrics) &&
		posts.some((item) => {
			const postKey = getSelfMediaPostKey(item)
			const metricState = opsArtifactStatesByPostKey.get(postKey)?.metrics
			if (!metricState?.ready) return false
			const requestSignature = buildOpsMetricsRequestSignature(postKey, metricState)
			const loadState = opsMetricsLoadStateByPostKey.get(postKey)
			return (
				!loadState ||
				loadState.signature !== requestSignature ||
				loadState.loading ||
				!opsMetricsByPostKey.has(postKey)
			)
		})
	const postsByPostKey = useMemo(
		() => new Map(posts.map((item) => [getSelfMediaPostKey(item), item])),
		[posts],
	)
	const activeOpsReviewDataVersion = activeOpsReviewTarget
		? buildOpsReviewDataVersion(
				opsArtifactStatesByPostKey.get(getSelfMediaPostKey(activeOpsReviewTarget)),
			)
		: ""
	const displayName = getSelfMediaHomeDisplayName(userInfo)
	const homeDailyInsight = useSelfMediaHomeDailyInsight({
		overview: opsOverview,
		displayName,
		enabled: Boolean(
			homeDailyInsightStorage && homeDailyInsightModelId && !isOpsMetricsHydrating,
		),
		model: homeDailyInsightModelId,
		storage: homeDailyInsightStorage,
	})
	const opsHealthInsight = useSelfMediaOpsHealthInsight({
		overview: opsOverview,
		enabled: Boolean(
			opsHealthInsightStorage && homeDailyInsightModelId && !isOpsMetricsHydrating,
		),
		model: homeDailyInsightModelId,
		storage: opsHealthInsightStorage,
	})
	const defaultWelcomeTitle = formatSelfMediaHomeWelcomeTitle(undefined, "", opsOverview)
	const greetingTitle = formatSelfMediaHomeWelcomeTitle(
		homeDailyInsight.insight?.welcomeTitle,
		defaultWelcomeTitle,
	)
	const greetingSubtitle = hasPosts
		? "按优先级推进发布、数据和复盘，先把今日重点往前推。"
		: t("detail.selfMedia.home.emptyDesc")
	const homeLayout = getSelfMediaHomeLayout(homeContainerWidth)
	const inlineHomeHeader = homeContainerWidth >= 900

	const handleOpenPost = useCallback(
		(
			target: { platform: SelfMediaPlatform; index: number },
			transition?: SelfMediaPostOpenTransitionPayload,
		) => {
			if (!transition || prefersReducedMotion()) {
				onOpenPost(target)
				return
			}

			if (openPostTransitionTimerRef.current) {
				window.clearTimeout(openPostTransitionTimerRef.current)
			}

			const targetPost = posts.find(
				(item) => item.platform === target.platform && item.index === target.index,
			)
			const postKey = targetPost
				? getSelfMediaPostKey(targetPost)
				: `${target.platform}:${target.index}:${transition.postId}`
			const nextOpeningPost = {
				postKey,
				style: {
					"--open-card-lift": "-4px",
					"--open-card-scale": "0.996",
				} as CSSProperties,
			}
			const viewTransitionDocument = getViewTransitionDocument()
			if (viewTransitionDocument) {
				flushSync(() => {
					setOpeningPost(nextOpeningPost)
				})
				viewTransitionDocument.startViewTransition?.(() => {
					flushSync(() => {
						onOpenPost(target)
					})
				})
				return
			}

			setOpeningPost(nextOpeningPost)
			openPostTransitionTimerRef.current = window.setTimeout(() => {
				onOpenPost(target)
				setOpeningPost(null)
				openPostTransitionTimerRef.current = null
			}, OPEN_POST_FALLBACK_TRANSITION_MS)
		},
		[onOpenPost, posts],
	)

	const handleOpsOverviewAction = useCallback(
		(action: SelfMediaOpsOverviewAction) => {
			executeSelfMediaOpsOverviewAction({
				action,
				postsByPostKey,
				onOpenPost: (target) => handleOpenPost(target),
				onCreateArticle,
				onOpenPublishedLinkBinding: (target) => {
					const postKey = getSelfMediaPostKey(target)
					setPublishedLinkAutoOpenTarget((current) => ({
						postKey,
						signal: (current?.signal ?? 0) + 1,
					}))
				},
				onPostPublishRefresh,
				onOpenOpsMetrics,
				onOpenOpsReview: setActiveOpsReviewTarget,
			})
		},
		[handleOpenPost, onCreateArticle, onOpenOpsMetrics, onPostPublishRefresh, postsByPostKey],
	)

	const aiCardFolders = useMemo(() => {
		if (!attachmentList?.length || !folderFileId) return []
		const selfMediaFolder = findSelfMediaFolderNode(attachmentList, folderFileId)
		const children = (selfMediaFolder?.children || []) as SelfMediaAttachmentNode[]
		return children.filter((node): node is AICardFolderItem =>
			Boolean(
				node.file_id && node.is_directory && isAICardDisplayConfig(node.display_config),
			),
		)
	}, [attachmentList, folderFileId])

	const handleRefreshAllData = useSelfMediaHomePageRuntime({
		posts,
		opsArtifactStateSignature,
		onEnsurePostLoaded,
		onLoadOpsMetrics,
		onRefreshAllData,
		requestedPreviewPostKeysRef,
		requestedOpsMetricsPostKeysRef,
		isHomePageMountedRef,
		currentOpsArtifactStatesRef,
		previousOpsArtifactStatesRef,
		openPostTransitionTimerRef,
		setOpsMetricsByPostKey,
		setOpsMetricsLoadStateByPostKey,
		setOpsArtifactAnimationsByPostKey,
	})

	return (
		<div
			className={cn(
				"self-media-home-stage relative flex h-full min-h-0 w-full flex-col",
				openingPost && "self-media-home-opening",
				className,
			)}
			style={SELF_MEDIA_WORKSPACE_BACKGROUND_STYLE}
			data-testid="self-media-home-page"
		>
			<SelfMediaHomeAnimations />
			<main className="min-h-0 flex-1" data-testid="self-media-home-main">
				<ScrollArea className="h-full" viewportRef={homeScrollViewportRef}>
					<div
						ref={homeContainerRef}
						className="mx-auto w-full min-w-0 max-w-5xl"
						data-home-layout={homeLayout}
					>
						<div className={cn("px-3 py-3", homeLayout !== "compact" && "px-6 py-6")}>
							<SelfMediaHomeHeader
								greetingTitle={greetingTitle}
								greetingSubtitle={greetingSubtitle}
								opening={Boolean(openingPost)}
								comfortable={inlineHomeHeader}
								onCreateArticle={onCreateArticle}
								onOpenBrandConfig={onOpenBrandConfig}
								onRefreshAllData={
									onRefreshAllData ? handleRefreshAllData : undefined
								}
								onCreateAICard={onCreateAICard}
								t={t}
							/>
							{hasPosts ? null : (
								<SelfMediaHomeEmptyState onCreateArticle={onCreateArticle} t={t} />
							)}
							<SelfMediaHomeAICardList
								aiCardFolders={aiCardFolders}
								attachmentList={attachmentList}
								openingPost={openingPost}
								onOpenAICardFolder={onOpenAICardFolder}
								t={t}
							/>
							<SelfMediaHomePostList
								postGroups={postGroups}
								postCount={posts.length}
								attachmentList={attachmentList}
								openingPost={openingPost}
								opsArtifactsByPostKey={displayedOpsArtifactsByPostKey}
								opsMetricsByPostKey={opsMetricsByPostKey}
								publishedUrlsByPostKey={publishedUrlsByPostKey}
								opsArtifactAnimationsByPostKey={opsArtifactAnimationsByPostKey}
								publishedLinkAutoOpenTarget={publishedLinkAutoOpenTarget}
								columnCount={getSelfMediaHomePostColumnCount(homeLayout)}
								onOpenPost={handleOpenPost}
								onRequestPrePublishAnalysis={onRequestPrePublishAnalysis}
								onPostPublishRefresh={onPostPublishRefresh}
								onConfigureAutoSync={onConfigureAutoSync}
								onOpenOpsReview={setActiveOpsReviewTarget}
								onLoadPublishedUrl={onLoadPublishedUrl}
								onLoadOpsSource={onLoadOpsSource}
								onBindPublishedUrl={onBindPublishedUrl}
								onRenamePost={onRenamePost}
								onDeletePost={onDeletePost}
								onMentionPost={onMentionPost}
								onSharePost={onSharePost}
								onSetPostPublishStatus={onSetPostPublishStatus}
								t={t}
							/>
							{hasPosts ? (
								<section
									className={cn(
										"self-media-home-enter-item mt-8",
										openingPost && "self-media-home-opening-dim",
									)}
									style={{ animationDelay: "230ms" }}
								>
									<SelfMediaOpsOverviewCard
										overview={opsOverview}
										allowEdit={allowEdit}
										onAction={allowEdit ? handleOpsOverviewAction : undefined}
										dailyInsight={homeDailyInsight.insight}
										dailyInsightStatus={homeDailyInsight.status}
										healthInsight={opsHealthInsight.insight}
										healthInsightStatus={opsHealthInsight.status}
										metricsLoading={isOpsMetricsHydrating}
										onRegenerateDailyInsight={
											allowEdit && homeDailyInsightStorage
												? homeDailyInsight.regenerate
												: undefined
										}
										onDismissDailyInsightAction={
											allowEdit && homeDailyInsightStorage
												? homeDailyInsight.dismissAction
												: undefined
										}
									/>
								</section>
							) : null}
						</div>
					</div>
				</ScrollArea>
			</main>
			<SelfMediaOpsReviewDashboard
				open={Boolean(activeOpsReviewTarget)}
				target={activeOpsReviewTarget}
				allowEdit={allowEdit}
				onClose={() => setActiveOpsReviewTarget(null)}
				onEditData={allowEdit ? onOpenOpsMetrics : undefined}
				onSyncData={allowEdit ? onPostPublishRefresh : undefined}
				onLoadData={onLoadOpsReviewData}
				dataVersion={activeOpsReviewDataVersion}
			/>
		</div>
	)
}

export default observer(SelfMediaHomePage)
