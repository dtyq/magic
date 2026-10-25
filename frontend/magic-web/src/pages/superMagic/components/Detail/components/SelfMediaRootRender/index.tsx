import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import MagicSpin from "@/components/base/MagicSpin"
import magicToast from "@/components/base/MagicToaster/utils"
import { Flex } from "antd"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import { topicModelStore } from "@/stores/superMagic"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ModelStatusEnum, type ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { ScheduledTask } from "@/types/scheduledTask"
import { getSuperIdState } from "@/pages/superMagic/utils/query"
import type { SelfMediaPlatform } from "../../types"
import UnsupportedPlatform from "./components/UnsupportedPlatform"
import { getPlatformComponent } from "./platforms"
import { SelfMediaStoreProvider, useSelfMediaStore } from "./stores"
import SelfMediaInitPanel from "./components/SelfMediaInitPanel"
import SelfMediaHomePage from "./components/SelfMediaHomePage"
import SelfMediaSplashScreen from "./components/SelfMediaSplashScreen"
import type { SelfMediaOpsReviewData } from "./components/SelfMediaOpsReviewDashboard"
import BrandConfigDialog from "./components/BrandConfigDialog"
import AICardCreateDialog, { type AICardCreateInitialValues } from "./components/AICardCreateDialog"
import SelfMediaOpsMetricsDialog from "./components/SelfMediaOpsMetricsDialog"
import PrePublishAnalysisDialog from "./components/PrePublishAnalysisDialog"
import { useSelfMediaHomeScrollMemory } from "./hooks/useSelfMediaHomeScrollPosition"
import { useSelfMediaPostShare } from "./hooks/useSelfMediaPostShare"
import {
	SelfMediaFileStorageService,
	type SelfMediaPostOpsMetricsPayload,
	type SelfMediaPostOpsSourcePayload,
} from "./services/SelfMediaFileStorageService"
import {
	resolveSelfMediaPostDirectoryAttachmentItem,
	resolveSelfMediaPostMentionFileId,
} from "./services/selfMediaCardChat"
import { resolveSelfMediaRootPath } from "./services/selfMediaPostPaths"
import {
	SELF_MEDIA_PRE_PUBLISH_TOPIC_PATTERN,
	sendSelfMediaPrePublishAnalysis,
	type SelfMediaPrePublishAnalysisGoal,
} from "./services/selfMediaPrePublishAnalysis"
import {
	SELF_MEDIA_POST_PUBLISH_DATA_TOPIC_PATTERN,
	buildFolderMention,
	sendSelfMediaPostPublishDataRefresh,
} from "./services/selfMediaPostPublishDataRefresh"
import { sendSelfMediaWechatCoverGeneration } from "./services/selfMediaWechatCoverGeneration"
import { clearPostPublishStatusAfterPublishedLinkBind } from "./services/selfMediaPostPublishStatus"
import {
	buildSelfMediaPostAutoSyncTaskData,
	disableSelfMediaPostAutoSyncTask,
	saveSelfMediaPostAutoSyncTask,
} from "./services/selfMediaPostAutoSync"
import type {
	SelfMediaAttachmentNode,
	SelfMediaPostEntry,
	SelfMediaPostMetaPatch,
	SelfMediaPostPublishStatus,
	SelfMediaRootRenderProps,
	SelfMediaWechatCoverType,
} from "./types"
import type { SelfMediaPlatformPostItem } from "./stores/SelfMediaStore"
import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"

type SelfMediaRootMode = "home" | "create" | "platform"
type Translate = (key: string, options?: Record<string, unknown>) => string

function getErrorMessage(error: unknown): string | null {
	if (error instanceof Error && error.message) return error.message
	if (typeof error === "string" && error.trim()) return error.trim()
	return null
}

function resolveActionFailureReason(t: Translate, error: unknown): string | null {
	const message = getErrorMessage(error)
	if (!message) return null
	if (message === "No project selected") {
		return t("detail.selfMedia.errors.noProjectSelected")
	}
	if (message === "Scheduled task id is missing") {
		return t("detail.selfMedia.errors.taskIdMissing")
	}
	return message
}

function showActionStartFailed(
	t: Translate,
	startFailedKey: string,
	error?: unknown,
	fallbackReasonKey?: string,
) {
	const reason = fallbackReasonKey ? t(fallbackReasonKey) : resolveActionFailureReason(t, error)
	magicToast.error(reason ? t(`${startFailedKey}WithReason`, { reason }) : t(startFailedKey))
}

function resolveFirstAvailableSelfMediaDataSyncModel(): ModelItem | null {
	return (
		superMagicModeService
			.getModelListByMode(SELF_MEDIA_POST_PUBLISH_DATA_TOPIC_PATTERN)
			.find(
				(model) =>
					model.model_status !== ModelStatusEnum.Disabled &&
					model.model_status !== ModelStatusEnum.Deleted,
			) ?? null
	)
}

/**
 * SelfMediaRootRender
 *
 * Hosts a `SelfMediaStoreProvider` that scopes a MobX `SelfMediaStore` to
 * the render tree below. All data + navigation state (slices / posts /
 * loading / active post + card / current view) lives in the store and is
 * driven by the upstream attachment tree via the store's `sync` lifecycle.
 *
 * The inner `observer` renders loading / unsupported. Each platform
 * component consumes the store through `useSelfMediaStore()`.
 */
function SelfMediaRootRender(props: SelfMediaRootRenderProps) {
	const fileAccess = useFileAccess()
	if (shouldWaitForShareAccess(fileAccess)) {
		return <MagicSpin />
	}
	const {
		data,
		attachments,
		attachmentList,
		className,
		saveEditContent,
		selectedProject,
		allowEdit = false,
		openFileTab,
	} = props
	const folderFileId = data?.file_id
	const folderPath = resolveSelfMediaRootPath(data)
	const innerAttachmentList = attachmentList || attachments

	// Access array lengths so that this observer component re-renders when items
	// are added to / removed from MobX observable arrays. Without this, mutations
	// to the same array reference would be invisible to the provider's useEffect.
	void attachments?.length
	void attachmentList?.length

	return (
		<SelfMediaStoreProvider
			folderFileId={folderFileId}
			attachments={attachments}
			attachmentList={attachmentList}
			initialNavigation={data?.initialNavigation}
		>
			<SelfMediaRootRenderInner
				attachments={attachments}
				attachmentList={innerAttachmentList}
				className={className}
				allowEdit={allowEdit}
				saveEditContent={saveEditContent}
				selectedProject={selectedProject}
				folderFileId={folderFileId}
				folderPath={folderPath}
				openFileTab={openFileTab}
			/>
		</SelfMediaStoreProvider>
	)
}

interface SelfMediaRootRenderInnerProps {
	attachments: SelfMediaRootRenderProps["attachments"]
	attachmentList: SelfMediaRootRenderProps["attachmentList"]
	className?: string
	allowEdit?: boolean
	saveEditContent?: SelfMediaRootRenderProps["saveEditContent"]
	selectedProject?: SelfMediaRootRenderProps["selectedProject"]
	folderFileId?: string
	folderPath?: string
	openFileTab?: (fileItem: SelfMediaAttachmentNode) => void
}

const SPLASH_SCREEN_SEEN_KEY = "selfMediaSplashSeen"

function shouldShowSelfMediaSplash() {
	if (process.env.NODE_ENV === "test") return false
	// if (process.env.NODE_ENV === "development") return true
	return localStorage.getItem(SPLASH_SCREEN_SEEN_KEY) !== "true"
}

const SelfMediaRootRenderInner = observer(function SelfMediaRootRenderInner({
	attachments,
	attachmentList,
	className,
	allowEdit,
	saveEditContent,
	selectedProject,
	folderFileId,
	folderPath,
	openFileTab,
}: SelfMediaRootRenderInnerProps) {
	const { t } = useTranslation("super")
	const fileApi = useFileApi()
	const store = useSelfMediaStore()
	const {
		canShare: canSharePost,
		isCheckingShare: sharePostLoading,
		sharePost,
		shareModals,
	} = useSelfMediaPostShare({
		attachments,
		selectedProject,
		enabled: Boolean(allowEdit),
	})
	const [showSplash, setShowSplash] = useState(shouldShowSelfMediaSplash)
	const [rootMode, setRootMode] = useState<SelfMediaRootMode | null>(null)
	const [aiCardDialogOpen, setAiCardDialogOpen] = useState(false)
	const [aiCardInitialValues, setAiCardInitialValues] =
		useState<AICardCreateInitialValues | null>(null)
	const [brandConfigOpen, setBrandConfigOpen] = useState(false)
	const [opsMetricsTarget, setOpsMetricsTarget] = useState<SelfMediaPlatformPostItem | null>(null)
	const [analysisTarget, setAnalysisTarget] = useState<{
		platform: SelfMediaPlatform
		index: number
	} | null>(null)
	const [analysisSubmitting, setAnalysisSubmitting] = useState(false)
	useEffect(() => {
		if (!allowEdit) setOpsMetricsTarget(null)
	}, [allowEdit])
	const homeScrollMemory = useSelfMediaHomeScrollMemory(
		`${folderFileId || ""}:${folderPath || ""}`,
	)
	const analysisModelList =
		superMagicModeService.getModelGroupsByMode(
			SELF_MEDIA_PRE_PUBLISH_TOPIC_PATTERN as unknown as TopicMode,
		) ?? []
	const selectedAnalysisModel = topicModelStore.selectedLanguageModel
	const dataSyncModel = resolveFirstAvailableSelfMediaDataSyncModel()

	const { platforms, resolvedPlatform: platform, rootLoading, sharedPostFallback } = store
	const projectId = selectedProject?.id || ""
	const fileStorageService = useMemo(
		() =>
			projectId
				? new SelfMediaFileStorageService(projectId, folderFileId, folderPath, fileApi)
				: null,
		[projectId, folderFileId, folderPath, fileApi],
	)

	// Detect empty project: no platforms configured and not loading
	const isEmptyProject = !rootLoading && platforms.length === 0
	const isSingleSharedPost = sharedPostFallback && store.allPosts.length === 1
	const activeRootMode =
		rootMode ?? (isSingleSharedPost ? "platform" : isEmptyProject ? "create" : "home")

	// A cached file-viewer tab can switch to another folder without remounting this component.
	useEffect(() => {
		setRootMode(null)
	}, [folderFileId])

	useEffect(() => {
		if (rootLoading || rootMode !== null) return
		setRootMode(
			isSingleSharedPost ? "platform" : isEmptyProject && allowEdit ? "create" : "home",
		)
	}, [isEmptyProject, rootLoading, rootMode, allowEdit, isSingleSharedPost])
	const handleStartCreateArticle = useCallback(() => {
		setRootMode("create")
	}, [])
	const handleOpenBrandConfig = useCallback(() => {
		setBrandConfigOpen(true)
	}, [])
	const handleRefreshAllData = useCallback(async () => {
		try {
			await store.init({ preserveNavigation: true })
		} catch (error) {
			console.error("Self-media refresh all data failed:", error)
			showActionStartFailed(t, "detail.selfMedia.opsRefresh.startFailed", error)
		}
	}, [store, t])
	const handleOpenAICardCreate = useCallback((initialValues?: AICardCreateInitialValues) => {
		setAiCardInitialValues(initialValues ?? null)
		setAiCardDialogOpen(true)
	}, [])
	const handleOpenOpsMetrics = useCallback((target: SelfMediaPlatformPostItem) => {
		setOpsMetricsTarget(target)
	}, [])
	const handleBackHome = useCallback(() => {
		store.goHomeList()
		setRootMode("home")
	}, [store])
	const handleOpenPost = useCallback(
		({ platform: nextPlatform, index }: { platform: SelfMediaPlatform; index: number }) => {
			store.handleChangePlatform(nextPlatform)
			store.openPostDetail(index)
			setRootMode("platform")
		},
		[store],
	)
	const handleEnsureHomePostLoaded = useCallback(
		({ platform: nextPlatform, index }: { platform: SelfMediaPlatform; index: number }) => {
			void store.ensurePlatformPostLoaded(nextPlatform, index)
		},
		[store],
	)
	const handleShowPlatform = useCallback(() => {
		setRootMode("platform")
	}, [])
	const handleOpenAICardFolder = useCallback(
		(folder: SelfMediaAttachmentNode) => {
			openFileTab?.(folder)
		},
		[openFileTab],
	)
	const handleMentionHomePost = useCallback(
		async (target: SelfMediaPlatformPostItem) => {
			try {
				const post =
					(await store.ensurePlatformPostLoaded(target.platform, target.index)) ||
					target.post
				const mentionFileId = resolveSelfMediaPostMentionFileId(post)
				const postDirectoryItem = resolveSelfMediaPostDirectoryAttachmentItem(
					attachmentList,
					mentionFileId,
					target.entry.entry,
				)
				if (!postDirectoryItem) {
					showActionStartFailed(
						t,
						"detail.selfMedia.mentionPost.startFailed",
						undefined,
						"detail.selfMedia.errors.postDirectoryMissing",
					)
					return
				}
				pubsub.publish(PubSubEvents.Add_File_To_Chat, {
					items: [buildFolderMention(postDirectoryItem)],
					is_new_topic: false,
					autoFocus: true,
				})
				magicToast.success(t("detail.selfMedia.mentionPost.success"))
			} catch (error) {
				console.error("Self-media post mention failed:", error)
				showActionStartFailed(t, "detail.selfMedia.mentionPost.startFailed", error)
			}
		},
		[attachmentList, store, t],
	)
	const handleRequestPrePublishAnalysis = useCallback(
		(target: { platform: SelfMediaPlatform; index: number }) => {
			setAnalysisTarget(target)
		},
		[],
	)
	const handlePostPublishRefresh = useCallback(
		async (target: SelfMediaPlatformPostItem, publishedUrlOverride?: string) => {
			try {
				const publishedUrl =
					publishedUrlOverride?.trim() ||
					(
						await fileStorageService?.loadPostOpsSource(target.entry.entry)
					)?.publishedUrl?.trim()
				if (!publishedUrl) {
					setOpsMetricsTarget(target)
					magicToast.error(t("detail.selfMedia.opsRefresh.missingSourceUrl"))
					return
				}
				const post =
					(await store.ensurePlatformPostLoaded(target.platform, target.index)) ||
					target.post
				const mentionFileId = resolveSelfMediaPostMentionFileId(post)
				const postDirectoryItem = resolveSelfMediaPostDirectoryAttachmentItem(
					attachmentList,
					mentionFileId,
					target.entry.entry,
				)
				if (!postDirectoryItem) {
					showActionStartFailed(
						t,
						"detail.selfMedia.opsRefresh.startFailed",
						undefined,
						"detail.selfMedia.errors.postDirectoryMissing",
					)
					return
				}
				await sendSelfMediaPostPublishDataRefresh({
					selectedProject,
					platform: target.platform,
					selectedModel: dataSyncModel,
					publishedUrl,
					post,
					postDirectoryItem,
				})
			} catch (error) {
				console.error("Self-media post-publish data refresh failed:", error)
				showActionStartFailed(t, "detail.selfMedia.opsRefresh.startFailed", error)
			}
		},
		[attachmentList, dataSyncModel, fileStorageService, selectedProject, store, t],
	)
	const handleUpdateAutoSyncPublishedUrl = useCallback(
		async (
			target: SelfMediaPlatformPostItem,
			publishedUrl: string,
			autoSync: NonNullable<SelfMediaPostOpsSourcePayload["autoSync"]>,
		) => {
			if (!autoSync.enabled || !autoSync.taskId) return true
			const post =
				(await store.ensurePlatformPostLoaded(target.platform, target.index)) || target.post
			const mentionFileId = resolveSelfMediaPostMentionFileId(post)
			const postDirectoryItem = resolveSelfMediaPostDirectoryAttachmentItem(
				attachmentList,
				mentionFileId,
				target.entry.entry,
			)
			const routeState = getSuperIdState()
			const workspaceId =
				(selectedProject as { workspace_id?: string } | null | undefined)?.workspace_id ||
				routeState.workspaceId ||
				""
			const projectId = selectedProject?.id || routeState.projectId || ""
			if (!workspaceId || !projectId || !postDirectoryItem) {
				showActionStartFailed(
					t,
					"detail.selfMedia.opsRefresh.startFailed",
					undefined,
					"detail.selfMedia.errors.projectContextMissing",
				)
				return false
			}
			const taskData = buildSelfMediaPostAutoSyncTaskData({
				workspaceId,
				projectId,
				platform: target.platform,
				publishedUrl,
				post,
				postDirectoryItem,
				timeConfig: autoSync.timeConfig,
				model: dataSyncModel,
				taskId: autoSync.taskId,
			})
			try {
				await saveSelfMediaPostAutoSyncTask(taskData, autoSync.taskId)
				return true
			} catch (error) {
				console.error("Self-media auto sync published URL update failed:", error)
				showActionStartFailed(t, "detail.selfMedia.opsRefresh.startFailed", error)
				return false
			}
		},
		[attachmentList, dataSyncModel, selectedProject, store, t],
	)
	const handleConfigurePostAutoSync = useCallback(
		async (
			target: SelfMediaPlatformPostItem,
			config: { enabled: boolean; timeConfig: ScheduledTask.TimeConfig },
		) => {
			try {
				if (!fileStorageService) return false
				const source = await fileStorageService.loadPostOpsSource(target.entry.entry)
				const publishedUrl = source?.publishedUrl?.trim()
				if (!publishedUrl && config.enabled) {
					setOpsMetricsTarget(target)
					magicToast.error(t("detail.selfMedia.opsRefresh.missingSourceUrl"))
					return false
				}
				const updatedAt = new Date().toISOString()

				if (!config.enabled) {
					const existingTaskId = source?.autoSync?.taskId
					if (existingTaskId) {
						if (!publishedUrl) {
							showActionStartFailed(
								t,
								"detail.selfMedia.opsRefresh.startFailed",
								undefined,
								"detail.selfMedia.errors.publishedUrlMissing",
							)
							return false
						}
						const post =
							(await store.ensurePlatformPostLoaded(target.platform, target.index)) ||
							target.post
						const mentionFileId = resolveSelfMediaPostMentionFileId(post)
						const postDirectoryItem = resolveSelfMediaPostDirectoryAttachmentItem(
							attachmentList,
							mentionFileId,
							target.entry.entry,
						)
						const routeState = getSuperIdState()
						const workspaceId =
							(selectedProject as { workspace_id?: string } | null | undefined)
								?.workspace_id ||
							routeState.workspaceId ||
							""
						const projectId = selectedProject?.id || routeState.projectId || ""
						if (!workspaceId || !projectId || !postDirectoryItem) {
							showActionStartFailed(
								t,
								"detail.selfMedia.opsRefresh.startFailed",
								undefined,
								"detail.selfMedia.errors.projectContextMissing",
							)
							return false
						}
						const taskData = buildSelfMediaPostAutoSyncTaskData({
							workspaceId,
							projectId,
							platform: target.platform,
							publishedUrl,
							post,
							postDirectoryItem,
							timeConfig: config.timeConfig,
							model: dataSyncModel,
							enabled: 0,
							taskId: existingTaskId,
						})
						await disableSelfMediaPostAutoSyncTask(existingTaskId, taskData)
					}
					await fileStorageService.savePostOpsSource(target.entry.entry, {
						version: 1,
						updatedAt,
						platform: source?.platform || target.platform,
						publishedUrl: publishedUrl || source?.publishedUrl || "",
						fetchStatus: source?.fetchStatus,
						lastFetchedAt: source?.lastFetchedAt,
						failureReason: source?.failureReason,
						notes: source?.notes,
						autoSync: {
							...source?.autoSync,
							enabled: false,
							timeConfig: config.timeConfig,
							updatedAt,
						},
					})
					return true
				}

				const post =
					(await store.ensurePlatformPostLoaded(target.platform, target.index)) ||
					target.post
				const mentionFileId = resolveSelfMediaPostMentionFileId(post)
				const postDirectoryItem = resolveSelfMediaPostDirectoryAttachmentItem(
					attachmentList,
					mentionFileId,
					target.entry.entry,
				)
				const routeState = getSuperIdState()
				const workspaceId =
					(selectedProject as { workspace_id?: string } | null | undefined)
						?.workspace_id ||
					routeState.workspaceId ||
					""
				const projectId = selectedProject?.id || routeState.projectId || ""
				if (!workspaceId || !projectId || !postDirectoryItem) {
					showActionStartFailed(
						t,
						"detail.selfMedia.opsRefresh.startFailed",
						undefined,
						"detail.selfMedia.errors.projectContextMissing",
					)
					return false
				}

				const taskData = buildSelfMediaPostAutoSyncTaskData({
					workspaceId,
					projectId,
					platform: target.platform,
					publishedUrl,
					post,
					postDirectoryItem,
					timeConfig: config.timeConfig,
					model: dataSyncModel,
					taskId: source?.autoSync?.taskId,
				})
				const taskId = await saveSelfMediaPostAutoSyncTask(
					taskData,
					source?.autoSync?.taskId,
				)
				if (!taskId) {
					throw new Error("Scheduled task id is missing")
				}
				await fileStorageService.savePostOpsSource(target.entry.entry, {
					version: 1,
					updatedAt,
					platform: source?.platform || target.platform,
					publishedUrl,
					fetchStatus: source?.fetchStatus,
					lastFetchedAt: source?.lastFetchedAt,
					failureReason: source?.failureReason,
					notes: source?.notes,
					autoSync: {
						enabled: true,
						taskId,
						timeConfig: config.timeConfig,
						updatedAt,
					},
				})
				return true
			} catch (error) {
				console.error("Self-media auto sync configuration failed:", error)
				showActionStartFailed(t, "detail.selfMedia.opsRefresh.startFailed", error)
				return false
			}
		},
		[attachmentList, dataSyncModel, fileStorageService, selectedProject, store, t],
	)
	const handleLoadPostPublishedUrl = useCallback(
		async (target: SelfMediaPlatformPostItem) => {
			const source = await fileStorageService?.loadPostOpsSource(target.entry.entry)
			return source?.publishedUrl?.trim() || undefined
		},
		[fileStorageService],
	)
	const handleLoadPostOpsSource = useCallback(
		async (target: SelfMediaPlatformPostItem) => {
			return (await fileStorageService?.loadPostOpsSource(target.entry.entry)) ?? null
		},
		[fileStorageService],
	)
	const handleLoadPostOpsMetrics = useCallback(
		async (
			target: SelfMediaPlatformPostItem,
		): Promise<SelfMediaPostOpsMetricsPayload | null> => {
			return (await fileStorageService?.loadPostOpsMetrics(target.entry.entry)) ?? null
		},
		[fileStorageService],
	)
	const handleLoadPostOpsReviewData = useCallback(
		async (target: SelfMediaPlatformPostItem): Promise<SelfMediaOpsReviewData> => {
			if (!fileStorageService) {
				return {
					source: null,
					metrics: null,
					comments: null,
					reviewHtml: null,
					reviewMarkdown: null,
				}
			}
			const [source, metrics, comments, reviewHtml, reviewMarkdown] = await Promise.all([
				fileStorageService.loadPostOpsSource(target.entry.entry),
				fileStorageService.loadPostOpsMetrics(target.entry.entry),
				fileStorageService.loadPostOpsComments(target.entry.entry),
				fileStorageService.loadPostOpsReviewHtml(target.entry.entry),
				fileStorageService.loadPostOpsReview(target.entry.entry),
			])
			return { source, metrics, comments, reviewHtml, reviewMarkdown }
		},
		[fileStorageService],
	)
	const homeDailyInsightStorage = useMemo(
		() =>
			fileStorageService
				? {
						loadHomeDailyInsight: () => fileStorageService.loadHomeDailyInsight(),
						saveHomeDailyInsight: (
							payload: Parameters<typeof fileStorageService.saveHomeDailyInsight>[0],
						) => fileStorageService.saveHomeDailyInsight(payload),
					}
				: undefined,
		[fileStorageService],
	)
	const opsHealthInsightStorage = useMemo(
		() =>
			fileStorageService
				? {
						loadOpsHealthInsight: () => fileStorageService.loadOpsHealthInsight(),
						saveOpsHealthInsight: (
							payload: Parameters<typeof fileStorageService.saveOpsHealthInsight>[0],
						) => fileStorageService.saveOpsHealthInsight(payload),
					}
				: undefined,
		[fileStorageService],
	)
	const clearPostPublishStatus = useCallback(
		async (target: SelfMediaPlatformPostItem) => {
			await clearPostPublishStatusAfterPublishedLinkBind({
				target,
				fileStorageService,
				store,
			})
			return true
		},
		[fileStorageService, store],
	)
	const handleBindPostPublishedUrl = useCallback(
		async (target: SelfMediaPlatformPostItem, publishedUrl: string) => {
			try {
				if (!fileStorageService) return false
				const updatedAt = new Date().toISOString()
				const nextPublishedUrl = publishedUrl.trim()
				const source = await fileStorageService.loadPostOpsSource(target.entry.entry)
				const sourcePublishedUrl = source?.publishedUrl?.trim() || ""
				if (
					source?.autoSync?.enabled &&
					source.autoSync.taskId &&
					sourcePublishedUrl !== nextPublishedUrl
				) {
					const updated = await handleUpdateAutoSyncPublishedUrl(
						target,
						nextPublishedUrl,
						source.autoSync,
					)
					if (!updated) return false
				}
				await fileStorageService.savePostOpsSource(target.entry.entry, {
					version: 1,
					updatedAt,
					platform: source?.platform || target.platform,
					publishedUrl: nextPublishedUrl,
					fetchStatus: "pending",
					lastFetchedAt: source?.lastFetchedAt,
					failureReason: source?.failureReason,
					notes: source?.notes,
					...(source?.autoSync ? { autoSync: { ...source.autoSync, updatedAt } } : {}),
				})
				await clearPostPublishStatus(target)
				return true
			} catch (error) {
				console.error("Self-media published URL binding failed:", error)
				showActionStartFailed(t, "detail.selfMedia.opsRefresh.startFailed", error)
				return false
			}
		},
		[clearPostPublishStatus, fileStorageService, handleUpdateAutoSyncPublishedUrl, t],
	)
	const handleSetPostPublishStatus = useCallback(
		async (target: SelfMediaPlatformPostItem, publishStatus?: SelfMediaPostPublishStatus) => {
			try {
				if (!fileStorageService) return false
				await fileStorageService.setPostPublishStatus({
					platform: target.platform,
					id: target.entry.id,
					entry: target.entry.entry,
					publishStatus,
				})
				store.updatePlatformPostPublishStatus(
					target.platform,
					target.entry.id,
					publishStatus,
				)
				magicToast.success(
					t(
						publishStatus
							? "detail.selfMedia.home.archivePostSuccess"
							: "detail.selfMedia.home.restorePostPublishSuccess",
					),
				)
				return true
			} catch (error) {
				console.error("Self-media post publish status update failed:", error)
				magicToast.error(t("detail.selfMedia.home.setPostPublishStatusFailed"))
				return false
			}
		},
		[fileStorageService, store, t],
	)
	const handleDeletePost = useCallback(
		async (target: SelfMediaPlatformPostItem) => {
			try {
				if (!fileStorageService) return false
				await fileStorageService.deletePost({
					platform: target.platform,
					id: target.entry.id,
					entry: target.entry.entry,
				})
				store.removePlatformPost(target.platform, target.entry.id)
				magicToast.success(t("detail.selfMedia.home.deletePostSuccess"))
				return true
			} catch (error) {
				console.error("Self-media post deletion failed:", error)
				magicToast.error(t("detail.selfMedia.home.deletePostFailed"))
				return false
			}
		},
		[fileStorageService, store, t],
	)
	const handleUpdatePostTitle = useCallback(
		async (
			target: { platform: SelfMediaPlatform; index: number; entry: SelfMediaPostEntry },
			nextTitle: string,
			errorMessageKey = "detail.selfMedia.titleEdit.failed",
		) => {
			try {
				if (!fileStorageService) return false
				await fileStorageService.updatePostTitle(target.entry.entry, nextTitle)
				return true
			} catch (error) {
				console.error("Self-media post title update failed:", error)
				magicToast.error(t(errorMessageKey, "标题保存失败，请稍后重试"))
				return false
			}
		},
		[fileStorageService, t],
	)
	const handleUpdatePostMeta = useCallback(
		async (
			target: { platform: SelfMediaPlatform; index: number; entry: SelfMediaPostEntry },
			patch: SelfMediaPostMetaPatch,
		) => {
			try {
				if (!fileStorageService) return false
				await fileStorageService.updatePostMeta(target.entry.entry, patch)
				return true
			} catch (error) {
				console.error("Self-media post metadata update failed:", error)
				magicToast.error(
					t(
						"detail.selfMedia.platform.rednote.metaEdit.failed",
						"内容保存失败，请稍后重试",
					),
				)
				return false
			}
		},
		[fileStorageService, t],
	)
	const handleRenameHomePost = useCallback(
		async (target: SelfMediaPlatformPostItem, nextTitle: string) => {
			try {
				if (!fileStorageService) return false
				await fileStorageService.renamePost({
					platform: target.platform,
					id: target.entry.id,
					entry: target.entry.entry,
					name: nextTitle,
				})
				store.updatePlatformPostTitle(target.platform, target.entry.id, nextTitle)
				magicToast.success(t("detail.selfMedia.home.renamePostSuccess"))
				return true
			} catch (error) {
				console.error("Self-media post rename failed:", error)
				magicToast.error(t("detail.selfMedia.home.renamePostFailed"))
				return false
			}
		},
		[fileStorageService, store, t],
	)
	const handleRequestActivePrePublishAnalysis = useCallback(() => {
		if (!platform) return
		handleRequestPrePublishAnalysis({
			platform: platform as SelfMediaPlatform,
			index: store.activePostIndex,
		})
	}, [handleRequestPrePublishAnalysis, platform, store.activePostIndex])
	const handleShareActivePost = useCallback(() => {
		if (!platform) return
		const target = store.allPosts.find(
			(item) => item.platform === platform && item.index === store.activePostIndex,
		)
		if (target) void sharePost(target)
	}, [platform, sharePost, store])
	const handleRequestWechatCoverGeneration = useCallback(
		async ({
			index,
			coverTypes,
		}: {
			index: number
			coverTypes: SelfMediaWechatCoverType[]
		}) => {
			try {
				const targetItem = store.allPosts.find(
					(item) => item.platform === "wechat-official-accounts" && item.index === index,
				)
				const post =
					(await store.ensurePlatformPostLoaded("wechat-official-accounts", index)) ||
					targetItem?.post
				const missingCoverTypes = coverTypes.filter(
					(coverType) => !post?.[coverType]?.fileId,
				)
				const mentionFileId = resolveSelfMediaPostMentionFileId(post)
				const postDirectoryItem = resolveSelfMediaPostDirectoryAttachmentItem(
					attachmentList,
					mentionFileId,
					targetItem?.entry.entry,
				)
				if (!post || !postDirectoryItem) {
					showActionStartFailed(
						t,
						"detail.selfMedia.coverGeneration.startFailed",
						undefined,
						"detail.selfMedia.errors.postDirectoryMissing",
					)
					return false
				}
				if (missingCoverTypes.length === 0) {
					await store.init({ preserveNavigation: true })
					return false
				}
				await sendSelfMediaWechatCoverGeneration({
					selectedProject,
					selectedModel: selectedAnalysisModel,
					post,
					postDirectoryItem,
					coverTypes: missingCoverTypes,
				})
				magicToast.success(t("detail.selfMedia.coverGeneration.started"))
				return true
			} catch (error) {
				console.error("Self-media WeChat cover generation failed:", error)
				showActionStartFailed(t, "detail.selfMedia.coverGeneration.startFailed", error)
				return false
			}
		},
		[attachmentList, selectedAnalysisModel, selectedProject, store, t],
	)
	const handleConfirmPrePublishAnalysis = useCallback(
		async (analysisGoal: SelfMediaPrePublishAnalysisGoal, selectedModel: ModelItem | null) => {
			if (!analysisTarget) return
			setAnalysisSubmitting(true)
			try {
				const targetItem = store.allPosts.find(
					(item) =>
						item.platform === analysisTarget.platform &&
						item.index === analysisTarget.index,
				)
				const post =
					(await store.ensurePlatformPostLoaded(
						analysisTarget.platform,
						analysisTarget.index,
					)) || targetItem?.post
				const mentionFileId = resolveSelfMediaPostMentionFileId(post)
				const postDirectoryItem = resolveSelfMediaPostDirectoryAttachmentItem(
					attachmentList,
					mentionFileId,
					targetItem?.entry.entry,
				)
				if (!post || !postDirectoryItem) {
					showActionStartFailed(
						t,
						"detail.selfMedia.analysis.startFailed",
						undefined,
						"detail.selfMedia.errors.postDirectoryMissing",
					)
					return
				}
				await sendSelfMediaPrePublishAnalysis({
					selectedProject,
					platform: analysisTarget.platform,
					analysisGoal,
					selectedModel,
					post,
					postDirectoryItem,
				})
				setAnalysisTarget(null)
			} catch (error) {
				console.error("Self-media pre-publish analysis failed:", error)
				showActionStartFailed(t, "detail.selfMedia.analysis.startFailed", error)
			} finally {
				setAnalysisSubmitting(false)
			}
		},
		[analysisTarget, attachmentList, selectedProject, store, t],
	)

	const PlatformComponent = useMemo(() => getPlatformComponent(platform), [platform])

	const handleSplashComplete = useCallback(() => {
		localStorage.setItem(SPLASH_SCREEN_SEEN_KEY, "true")
		setShowSplash(false)
	}, [])

	const renderContent = () => {
		if (rootLoading) {
			return (
				<Flex
					justify="center"
					align="center"
					className={cn("h-full w-full bg-background", className)}
					data-testid="self-media-root-loading"
				>
					<MagicSpin spinning />
				</Flex>
			)
		}

		if (activeRootMode === "create" && isEmptyProject) {
			if (!allowEdit) {
				return (
					<Flex
						justify="center"
						align="center"
						className={cn("h-full w-full bg-background", className)}
					>
						<p className="text-sm text-muted-foreground">
							{t("detail.selfMedia.home.subtitle")}
						</p>
					</Flex>
				)
			}
			return (
				<div
					className={cn("h-full min-h-0 w-full", className)}
					data-testid="self-media-init-panel"
				>
					<SelfMediaInitPanel
						selectedProject={selectedProject}
						folderFileId={folderFileId}
						folderPath={folderPath}
						attachmentList={attachmentList}
						onBackHome={handleBackHome}
					/>
				</div>
			)
		}

		if (activeRootMode === "home") {
			return (
				<div
					className={cn("h-full min-h-0 w-full", className)}
					data-testid="self-media-root"
				>
					<SelfMediaHomePage
						posts={store.allPosts}
						allowEdit={allowEdit}
						attachmentList={attachmentList}
						onEnsurePostLoaded={handleEnsureHomePostLoaded}
						onCreateArticle={allowEdit ? handleStartCreateArticle : undefined}
						onOpenPost={handleOpenPost}
						onRequestPrePublishAnalysis={
							allowEdit ? handleRequestPrePublishAnalysis : undefined
						}
						onOpenOpsMetrics={allowEdit ? handleOpenOpsMetrics : undefined}
						onPostPublishRefresh={allowEdit ? handlePostPublishRefresh : undefined}
						onConfigureAutoSync={allowEdit ? handleConfigurePostAutoSync : undefined}
						onLoadOpsReviewData={handleLoadPostOpsReviewData}
						onLoadOpsMetrics={handleLoadPostOpsMetrics}
						onLoadPublishedUrl={allowEdit ? handleLoadPostPublishedUrl : undefined}
						onLoadOpsSource={allowEdit ? handleLoadPostOpsSource : undefined}
						onBindPublishedUrl={allowEdit ? handleBindPostPublishedUrl : undefined}
						onRenamePost={allowEdit ? handleRenameHomePost : undefined}
						onDeletePost={allowEdit ? handleDeletePost : undefined}
						onSetPostPublishStatus={allowEdit ? handleSetPostPublishStatus : undefined}
						onMentionPost={allowEdit ? handleMentionHomePost : undefined}
						onSharePost={canSharePost ? sharePost : undefined}
						onOpenBrandConfig={allowEdit ? handleOpenBrandConfig : undefined}
						onRefreshAllData={allowEdit ? handleRefreshAllData : undefined}
						onCreateAICard={allowEdit ? handleOpenAICardCreate : undefined}
						onOpenAICardFolder={openFileTab ? handleOpenAICardFolder : undefined}
						homeDailyInsightStorage={homeDailyInsightStorage}
						opsHealthInsightStorage={opsHealthInsightStorage}
						homeDailyInsightModelId={dataSyncModel?.model_id}
						initialScrollTop={homeScrollMemory.initialScrollTop}
						onScrollTopChange={homeScrollMemory.onScrollTopChange}
						folderFileId={folderFileId}
					/>
					<BrandConfigDialog
						open={brandConfigOpen}
						onOpenChange={setBrandConfigOpen}
						fileStorageService={fileStorageService}
						attachmentList={attachmentList}
					/>
					<AICardCreateDialog
						open={aiCardDialogOpen}
						onOpenChange={(open) => {
							setAiCardDialogOpen(open)
							if (!open) setAiCardInitialValues(null)
						}}
						projectId={projectId}
						folderPath={folderPath}
						initialValues={aiCardInitialValues ?? undefined}
					/>
					<SelfMediaOpsMetricsDialog
						open={allowEdit && Boolean(opsMetricsTarget)}
						onOpenChange={(open) => {
							if (!open) setOpsMetricsTarget(null)
						}}
						target={opsMetricsTarget}
						fileStorageService={fileStorageService}
						onUpdateAutoSyncPublishedUrl={
							allowEdit ? handleUpdateAutoSyncPublishedUrl : undefined
						}
						onFetchPublishedData={allowEdit ? handlePostPublishRefresh : undefined}
					/>
					<PrePublishAnalysisDialog
						open={Boolean(analysisTarget)}
						onOpenChange={(open) => {
							if (!open) setAnalysisTarget(null)
						}}
						onConfirm={handleConfirmPrePublishAnalysis}
						loading={analysisSubmitting}
						modelList={analysisModelList}
						selectedModel={selectedAnalysisModel}
					/>
				</div>
			)
		}

		if (activeRootMode === "create") {
			return (
				<div
					className={cn("h-full min-h-0 w-full", className)}
					data-testid="self-media-root"
				>
					<div className="h-full min-h-0" data-testid="self-media-init-panel">
						<SelfMediaInitPanel
							selectedProject={selectedProject}
							folderFileId={folderFileId}
							folderPath={folderPath}
							attachmentList={attachmentList}
							onBackHome={handleBackHome}
						/>
					</div>
				</div>
			)
		}

		if (!PlatformComponent) {
			return (
				<div className={cn("h-full w-full", className)}>
					<UnsupportedPlatform platform={platform} />
					<button
						type="button"
						className="sr-only"
						onClick={handleShowPlatform}
						data-testid="handle-show-platform"
					>
						{t("detail.selfMedia.home.openPlatform")}
					</button>
				</div>
			)
		}

		return (
			<div className={cn("relative h-full w-full", className)} data-testid="self-media-root">
				<style>{`
					@keyframes self-media-platform-detail-in {
						from {
							opacity: 0;
							transform: translate3d(0, 6px, 0) scale(0.996);
						}
						to {
							opacity: 1;
							transform: translate3d(0, 0, 0) scale(1);
						}
					}
					@keyframes self-media-workspace-view-out {
						from {
							opacity: 1;
							transform: translate3d(0, 0, 0) scale(1);
						}
						to {
							opacity: 0;
							transform: translate3d(0, -4px, 0) scale(0.996);
						}
					}
					@keyframes self-media-workspace-view-in {
						from {
							opacity: 0;
							transform: translate3d(0, 6px, 0) scale(0.996);
						}
						to {
							opacity: 1;
							transform: translate3d(0, 0, 0) scale(1);
						}
					}
					.self-media-platform-detail-stage {
						animation: self-media-platform-detail-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
						contain: layout;
						view-transition-name: self-media-workspace;
						will-change: transform, opacity;
					}
					@supports (view-transition-name: self-media-workspace) {
						::view-transition-old(self-media-workspace) {
							animation: self-media-workspace-view-out 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
						}
						::view-transition-new(self-media-workspace) {
							animation: self-media-workspace-view-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
						}
					}
					@media (prefers-reduced-motion: reduce) {
						.self-media-platform-detail-stage {
							animation: none !important;
							opacity: 1 !important;
							transform: none !important;
						}
					}
				`}</style>
				<div
					className="self-media-platform-detail-stage h-full w-full"
					data-testid="self-media-platform-detail-stage"
				>
					<Suspense
						fallback={
							<Flex justify="center" align="center" className="h-full w-full">
								<MagicSpin spinning />
							</Flex>
						}
					>
						<PlatformComponent
							platform={platform as SelfMediaPlatform}
							attachments={attachments}
							attachmentList={attachmentList}
							allowEdit={allowEdit}
							saveEditContent={saveEditContent}
							selectedProject={selectedProject}
							onBackHome={handleBackHome}
							onUpdatePostTitle={allowEdit ? handleUpdatePostTitle : undefined}
							onUpdatePostMeta={allowEdit ? handleUpdatePostMeta : undefined}
							onRequestPrePublishAnalysis={
								allowEdit ? handleRequestActivePrePublishAnalysis : undefined
							}
							onSharePost={canSharePost ? handleShareActivePost : undefined}
							shareLoading={sharePostLoading}
							onRequestWechatCoverGeneration={
								allowEdit ? handleRequestWechatCoverGeneration : undefined
							}
						/>
					</Suspense>
				</div>
				<PrePublishAnalysisDialog
					open={Boolean(analysisTarget)}
					onOpenChange={(open) => {
						if (!open) setAnalysisTarget(null)
					}}
					onConfirm={handleConfirmPrePublishAnalysis}
					loading={analysisSubmitting}
					modelList={analysisModelList}
					selectedModel={selectedAnalysisModel}
				/>
			</div>
		)
	}

	if (showSplash) {
		return (
			<div className={cn("h-full w-full", className)} data-testid="self-media-splash">
				<SelfMediaSplashScreen onComplete={handleSplashComplete} />
			</div>
		)
	}

	return (
		<div className={cn("relative h-full w-full", className)}>
			{renderContent()}
			{shareModals}
		</div>
	)
})

export default observer(SelfMediaRootRender)
