import { FileAccessProvider as FilePermissionsProvider } from "@/pages/superMagic/providers/FileAccessProvider"
import { IconFolder, IconGitFork, IconMaximize } from "@tabler/icons-react"
import { useMemoizedFn, useDebounceEffect, useDeepCompareEffect, useUpdateEffect } from "ahooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicSpin from "@/components/base/MagicSpin"
import { Button } from "@/components/shadcn-ui/button"
import magicToast from "@/components/base/MagicToaster/utils"
import { cn } from "@/utils/cn"
import { isEmpty } from "lodash-es"
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router"
import { ErrorDisplay, PasswordVerification, ShareEmptyState } from "./components"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

/** Research topics open on their results instead of the conversation replay. */
const ResearchShareView = lazy(
	() => import("@/pages/superMagic/pages/PersonaResearch/share/ResearchShareView"),
)
import ShareContent from "./components/ShareContent"
import CopyProjectModal from "./components/CopyProjectModal"
import CreatedByBadge from "./components/CreatedByBadge"
import { SuperMagicApi } from "@/apis"
import StatusIcon from "../superMagic/components/MessageHeader/components/StatusIcon"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import Logo from "@/layouts/BaseLayout/components/Header/components/Logo"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"
import { useTokenRefreshPolling } from "./hooks/useTokenRefreshPolling"
import WorkspaceButton from "./components/WorkspaceButton"
import { formatCopyProjectCount } from "@/utils/format"
import CopyProjectProgressToast from "@/components/base/CopyProjectProgressToast"
import useNavigate from "@/routes/hooks/useNavigate"
import useRoutesMetaSet from "@/routes/hooks/useRoutesMetaSet"
import useShareRoute from "../superMagic/hooks/useShareRoute"
import useLegacyFileShareData from "./hooks/useLegacyFileShareData"
import useLegacyTopicShareData from "./hooks/useLegacyTopicShareData"
import useNewFileShareData from "./hooks/useNewFileShareData"
import useNewTopicShareData from "./hooks/useNewTopicShareData"
import { userStore } from "@/models/user"
import { useUserInfo } from "@/models/user/hooks"
import { MagicAvatar } from "@/components/base"
import useBackHandler from "@/utils/historyStackManager/hooks"
import { useSharePermission } from "./hooks/useSharePermission"
import UserAvatar from "@/assets/logos/user-avatar.svg"
import { RecordingDetailShareDesktop } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailShareDesktop"
import ShareMobileAudioRecordingDetailPage from "@/pages/superMagicMobile/pages/AudioRecordingDetail/ShareMobileAudioRecordingDetailPage"
import { shouldRenderAudioRecordingShareShell } from "@/pages/superMagic/pages/AudioRecordings/utils/share-recording-detail"
import {
	calculateDefaultOpenFileId,
	findFileInTree,
} from "@/pages/superMagic/components/Share/FileSelector/utils"
import { getAppEntryFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import SuperMagicService from "@/pages/superMagic/services"
import { resolveMobileAudioShareCreatedByBadgeBottom } from "./utils/audio-share-topbar-offset"
import { resolveShareErrorBackNavigation } from "./utils/share-error-back"
import usePureShareDocumentFlow from "./hooks/usePureShareDocumentFlow"
import { FileAccessProvider as FileAccessIdentityProvider } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { createShareFileAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
// import { fixJsonPropertyNames } from "../flow/components/FlowAssistant/utils/streamUtils"

const topicContainerBase =
	"flex items-center justify-between py-2.5 px-3.5 h-12 bg-card dark:bg-card backdrop-blur-[50px] border-b border-border rounded-[5px] w-full z-[99] max-md:absolute max-md:h-[calc(52px+var(--safe-area-inset-top,0px))] max-md:pt-[var(--safe-area-inset-top,0px)] max-md:px-3 max-md:pb-0 max-md:rounded-none"

function getAttachmentNodeId(node: any): string {
	return node?.file_id || node?.id || ""
}

function isHtmlAttachmentNode(node: any): boolean {
	if (!node) return false

	const nodeName = node?.display_filename || node?.file_name || node?.filename || node?.name || ""
	if (typeof nodeName === "string" && nodeName.toLowerCase().endsWith(".html")) return true

	return getFileType(node?.file_extension || "") === "html"
}

function resolvePreviewEntryNode(node: any): any {
	if (!node) return null
	if (!node?.is_directory) return node

	const entryFile = getAppEntryFile(node?.children || [], node?.display_config)
	if (!entryFile) return null

	return entryFile
}

function resolveImmersiveEntryFileId(params: {
	attachmentsTree: any[]
	defaultOpenFileId: string
	fileId: string
	isLegacy: boolean
}): string {
	const { attachmentsTree, defaultOpenFileId, fileId, isLegacy } = params
	if (!attachmentsTree?.length) return ""

	const fallbackTopLevelIds = attachmentsTree
		.map((item: any) => getAttachmentNodeId(item))
		.filter(Boolean)
	const candidateId =
		(isLegacy
			? fileId
			: defaultOpenFileId ||
				calculateDefaultOpenFileId(fallbackTopLevelIds, attachmentsTree)) || ""

	if (!candidateId) return ""

	const candidateNode = findFileInTree(attachmentsTree, candidateId)
	const previewEntryNode = resolvePreviewEntryNode(candidateNode)
	if (!previewEntryNode || !isHtmlAttachmentNode(previewEntryNode)) return ""

	return getAttachmentNodeId(previewEntryNode)
}

function toStringId(id: unknown): string {
	if (id === null || id === undefined) return ""
	return String(id)
}

function isTrueLike(value: unknown): boolean {
	if (value === true) return true
	if (typeof value === "number") return value === 1
	if (typeof value === "string") return ["true", "1"].includes(value.trim().toLowerCase())
	return false
}

const CAPTURE_QUERY_PARAM = "capture"

function getSharePureMode(shareData: any): boolean {
	return [
		shareData?.extra?.pure_mode,
		shareData?.pure_mode,
		shareData?.data?.extra?.pure_mode,
		shareData?.data?.pure_mode,
		shareData?.data?.data?.extra?.pure_mode,
		shareData?.data?.data?.pure_mode,
	].some(isTrueLike)
}

function getShareProjectCreatorUserId(shareData: ShareDataLike): string {
	return (
		toStringId(shareData?.data?.user_id) ||
		toStringId(shareData?.data?.created_uid) ||
		toStringId(shareData?.data?.creator?.user_id) ||
		toStringId(shareData?.data?.extended?.creator?.user_id) ||
		toStringId(shareData?.data?.data?.user_id) ||
		toStringId(shareData?.data?.data?.created_uid) ||
		toStringId(shareData?.creator?.user_id)
	)
}

function getShareProjectWorkspaceId(shareData: ShareDataLike): string {
	return toStringId(shareData?.data?.workspace_id || shareData?.data?.data?.workspace_id)
}

interface ShareCreatorLike {
	user_id?: unknown
}

interface ShareProjectLike {
	user_id?: unknown
	created_uid?: unknown
	workspace_id?: unknown
	creator?: ShareCreatorLike
	extended?: {
		creator?: ShareCreatorLike
	}
	data?: ShareProjectLike
}

interface ShareDataLike {
	data?: ShareProjectLike
	creator?: ShareCreatorLike
}

function Share() {
	const navigate = useNavigate()
	const { t } = useTranslation("super")
	const { userInfo } = useUserInfo()
	const { setMeta } = useRoutesMetaSet()
	// const [shareId, setShareId] = useState<string>("")
	const [isLogined, setIsLogined] = useState(false)
	const { pathname, search } = useLocation()
	// ✨ 权限管理 hook
	const { emptyStateInfo, handleSwitchOrganization, isSwitching, setRequiredOrgCode } =
		useSharePermission()
	const [isNeedPassword, setIsNeedPassword] = useState(false)
	const [resourceId, setResourceId] = useState("")
	const [projectId, setProjectId] = useState("")
	const [shareToken, setShareToken] = useState("")
	const [passwordFromUrl, setPasswordFromUrl] = useState("")
	const [data, setData] = useState({}) as any
	const [error, setError] = useState<Error | null>(null)
	const [attachments, setAttachments] = useState({} as any)
	const [loading, setLoading] = useState(false)
	const isMobile = useIsMobile()
	const [isProjectShare, setIsProjectShare] = useState(false)
	const [fileId, setFileId] = useState("")
	// Topic sharing: view_file_list state
	const [viewFileList, setViewFileList] = useState(false)
	const [defaultOpenFileId, setDefaultOpenFileId] = useState<string>("")
	const [currentPreviewFileId, setCurrentPreviewFileId] = useState<string | null>(null)
	const [previewIsFullscreen, setPreviewIsFullscreen] = useState(false)
	// 是否允许复制项目文件（默认为 true）
	const [allowCopyProjectFiles, setAllowCopyProjectFiles] = useState(false)
	// 是否允许下载项目文件（默认为 true）
	const [allowDownloadProjectFile, setAllowDownloadProjectFile] = useState(true)

	// Use route hook to determine route format
	const routeInfo = useShareRoute()

	// Use appropriate data hooks based on route format
	const legacyFileShareData = useLegacyFileShareData()
	const legacyTopicShareData = useLegacyTopicShareData()
	const newFileShareData = useNewFileShareData()
	const newTopicShareData = useNewTopicShareData()

	// Determine which hook to use based on route format
	const activeDataHook = useMemo(() => {
		if (routeInfo.isLegacy) {
			return routeInfo.isFileShare ? legacyFileShareData : legacyTopicShareData
		} else {
			return routeInfo.isFileShare ? newFileShareData : newTopicShareData
		}
	}, [
		routeInfo.isLegacy,
		routeInfo.isFileShare,
		legacyFileShareData,
		legacyTopicShareData,
		newFileShareData,
		newTopicShareData,
	])
	const [taskStatus, setTaskStatus] = useState("waiting")
	const [hasStarted, setHasStarted] = useState(false)
	const [showAllProjectFiles, setShowAllProjectFiles] = useState(false)
	const [isCopyProjectModalOpen, setIsCopyProjectModalOpen] = useState(false)
	// 复制进度相关状态
	const [showCopyProgress, setShowCopyProgress] = useState(false)
	const [copyingProjectId, setCopyingProjectId] = useState("")
	const [copyingProjectInfo, setCopyingProjectInfo] = useState<any>(null)
	const [copiedFilesProjectInfo, setCopiedFilesProjectInfo] = useState<{
		project_id: string
		project_name: string
		workspace_id: string
		workspace_name: string
	} | null>(null)
	// const [copyProjectProgress, setCopyProjectProgress] = useState(0)
	const [copyProjectIsRunning, setCopyProjectIsRunning] = useState(false)
	// 实际验证成功的密码（可能来自 URL 或用户手动输入）
	const [verifiedPassword, setVerifiedPasswordFn] = useState<string | undefined>(passwordFromUrl)
	const isFileShare = routeInfo.isFileShare
	const entryHtmlFileId = useMemo(() => {
		return resolveImmersiveEntryFileId({
			attachmentsTree: attachments?.tree || [],
			defaultOpenFileId,
			fileId,
			isLegacy: routeInfo.isLegacy,
		})
	}, [attachments?.tree, defaultOpenFileId, fileId, routeInfo.isLegacy])
	const isEntryHtmlPreview = Boolean(entryHtmlFileId) && currentPreviewFileId === entryHtmlFileId
	const shareDisplayOptions = useMemo(() => {
		const urlSearchParams = new URLSearchParams(search)
		const isPureMode = getSharePureMode(data)
		const enableFullPageScreenshot = isTrueLike(urlSearchParams.get(CAPTURE_QUERY_PARAM))

		return {
			forceFullscreenMode:
				isPureMode ||
				urlSearchParams.get("fullscreen") === "true" ||
				enableFullPageScreenshot,
			// Keep normal pure shares on the isolated viewport-scrolling path. Only an explicit
			// screenshot URL expands the iframe into the page document for whole-page capture.
			documentFlowFullscreen: enableFullPageScreenshot,
			hideHeader: isPureMode || urlSearchParams.has("hideHeader"),
			showFileHeader:
				isPureMode || urlSearchParams.get("showFileHeader") === "false" ? false : undefined,
		}
	}, [data, search])
	usePureShareDocumentFlow(shareDisplayOptions.documentFlowFullscreen)
	const enableImmersiveShareChrome = isMobile && isFileShare && isEntryHtmlPreview
	const effectivePreviewIsFullscreen =
		shareDisplayOptions.forceFullscreenMode || previewIsFullscreen
	const isImmersiveFullscreen = enableImmersiveShareChrome && effectivePreviewIsFullscreen

	useBackHandler(
		isImmersiveFullscreen,
		() => {
			pubsub.publish(PubSubEvents.Exit_Fullscreen)
		},
		"ShareImmersiveFullscreen",
	)

	const setVerifiedPassword = useMemoizedFn((verifiedPassword: string | undefined) => {
		setVerifiedPasswordFn(verifiedPassword)
	})

	useEffect(() => {
		setCurrentPreviewFileId(null)
		setPreviewIsFullscreen(false)
	}, [resourceId, pathname])

	useEffect(() => {
		if (!previewIsFullscreen) return
		if (!isMobile) return
		if (!isFileShare) return
		if (!entryHtmlFileId) return
		if (isEntryHtmlPreview) return

		pubsub.publish(PubSubEvents.Exit_Fullscreen)
		setPreviewIsFullscreen(false)
	}, [entryHtmlFileId, isEntryHtmlPreview, isMobile, isFileShare, previewIsFullscreen])

	useTokenRefreshPolling({
		resourceId,
		password: verifiedPassword,
		data,
		onTokenRefreshed: (tokenInfo) => {
			if (tokenInfo.temporary_token) {
				setShareToken(tokenInfo.temporary_token)
			}
		},
		onRefreshError: (error) => {
			console.error("Token refresh failed:", error)
		},
	})

	// Use getShareData from active hook
	const getShareData = useMemoizedFn(
		({ resource_id, password }: { resource_id: string; password?: string }) => {
			return activeDataHook.getShareData({ resource_id, password })
		},
	)

	// 从URL中删除password参数
	// const removePasswordFromUrl = useCallback(() => {
	// 	const urlSearchParams = new URLSearchParams(search)
	// 	if (urlSearchParams.has("password")) {
	// 		urlSearchParams.delete("password")
	// 		const newSearch = urlSearchParams.toString() ? `?${urlSearchParams.toString()}` : ""
	// 		navigate(`/share/${resourceId}${newSearch}`, { replace: true })
	// 	}
	// }, [search, resourceId, navigate])

	useUpdateEffect(() => {
		if (passwordFromUrl) {
			setVerifiedPassword(passwordFromUrl)
		}
	}, [passwordFromUrl])

	useEffect(() => {
		if (isFileShare) {
			const urlSearchParams = new URLSearchParams(search)
			if (urlSearchParams.has("showProject")) {
				setShowAllProjectFiles(true)
			}
		}
	}, [search, isFileShare])

	const updateAttachments = useCallback(
		(params: {
			projectId?: string
			resource_id?: string
			password?: string
			temporaryToken?: string
		}) => {
			if (activeDataHook.updateAttachments) {
				activeDataHook.updateAttachments(params)
			}
		},
		[activeDataHook],
	)

	useEffect(() => {
		if (data?.temporary_token) {
			const nextProjectId = data?.data?.project_id || data?.data?.data?.project_id
			setShareToken(data.temporary_token)
			updateAttachments({
				projectId: nextProjectId,
				password: verifiedPassword,
				resource_id: resourceId,
				temporaryToken: data.temporary_token,
			})
			setProjectId(nextProjectId)
		}
	}, [data])

	const updateShareInfo = useMemoizedFn(() => {
		// Use route info from useShareRoute hook
		if (routeInfo.isShareRoute) {
			const params = routeInfo.shareParams

			if (routeInfo.isLegacy) {
				// Legacy format
				if (routeInfo.isFileShare) {
					// Legacy file share: /share/{topicId}/file/{fileId}
					setResourceId(params.topicId || "")
					setFileId(params.fileId || "")
				} else {
					// Legacy topic share: /share/{topicId}
					setResourceId(params.topicId || "")
					setFileId("")
				}
			} else {
				// New format
				if (routeInfo.isFileShare) {
					// New file share: /share/files/{resourceId}
					setResourceId(params.resourceId || "")
					setFileId("")
				} else {
					// New topic share: /share/topic/{resourceId}
					setResourceId(params.resourceId || "")
					setFileId("")
				}
			}
		}
	})

	useDebounceEffect(() => {
		updateShareInfo()
	}, [pathname])

	// Sync attachments from active hook
	useEffect(() => {
		if (activeDataHook.attachments && Object.keys(activeDataHook.attachments).length > 0) {
			setAttachments(activeDataHook.attachments)
		}
	}, [activeDataHook.attachments])

	// Sync loading and error from active hook
	useEffect(() => {
		// New resource shares render the page shell independently of attachment tree assembly.
		// Their hook loading state covers cursor pagination and local tree processing, so syncing it
		// here would keep the whole share page behind the global loading mask.
		if (!routeInfo.isLegacy) return
		setLoading(activeDataHook.loading)
	}, [activeDataHook.loading, routeInfo.isLegacy])

	useEffect(() => {
		if (activeDataHook.error) {
			setError(activeDataHook.error)
		}
	}, [activeDataHook.error])

	// Sync isProjectShare from active hook (所有 hooks 现在都返回 isProjectShare)
	useEffect(() => {
		if ("isProjectShare" in activeDataHook) {
			const hook = activeDataHook as {
				isProjectShare: boolean
			}
			setIsProjectShare(hook.isProjectShare)
		}
	}, [activeDataHook])

	// 统一处理分享数据的设置
	const applyShareData = useMemoizedFn((newData: any) => {
		if (!newData) return

		setData(newData)

		// 设置 view_file_list
		// 如果 share_project 为 true，则 view_file_list 也应该为 true
		if (newData?.share_project === true) {
			setViewFileList(true)
		} else if (newData?.extra?.view_file_list !== undefined) {
			setViewFileList(newData.extra.view_file_list)
		}

		// 设置是否允许复制项目文件（默认为 true）
		setAllowCopyProjectFiles(newData?.extra?.allow_copy_project_files ?? true)

		// 设置是否允许下载项目文件（默认为 true）
		setAllowDownloadProjectFile(newData?.extra?.allow_download_project_file ?? true)

		// 新格式分享：设置 projectId 和 defaultOpenFileId
		if (!routeInfo.isLegacy) {
			if (newData?.data?.project_id) {
				setProjectId(newData.data.project_id)
			}
			if (newData?.default_open_file_id) {
				setDefaultOpenFileId(newData.default_open_file_id)
			}
		}
	})

	const updateShareData = useMemoizedFn(() => {
		if (resourceId) {
			setLoading(true)
			setError(null)
			SuperMagicApi.checkShareResourcePassword({ resource_id: resourceId })
				.then(async (res: any) => {
					setIsNeedPassword(res?.has_password)

					// 获取URL中的password参数
					const urlSearchParams = new URLSearchParams(search)
					const password = urlSearchParams.get("password")
					setPasswordFromUrl(password || "")
					console.log(res, "resresres")
					if (res?.user_id) {
						setIsLogined(true)
					} else {
						setIsLogined(false)
					}

					// ✨ 新增：处理权限信息

					if (!res?.has_password) {
						console.log("没有密码")
						return getShareData({ resource_id: resourceId })
							.then((newData: any) => {
								applyShareData(newData)
								return newData
							})
							.catch((err: Error) => {
								if (res) {
									setRequiredOrgCode(res?.required_magic_organization_code || "")
								}
								setError(err)
								return null
							})
					}

					if (res?.has_password && password) {
						console.log("有密码")
						// 如果需要密码且URL中有密码，直接尝试验证
						return getShareData({
							resource_id: resourceId,
							password,
						})
							.then((newData: any) => {
								applyShareData(newData)
								return newData
							})
							.catch(() => {
								// setError(err)
								return null
							})
					}

					return null
				})
				.catch((err) => {
					if (userStore.user.userInfo?.user_id) {
						setIsLogined(true)
					}
					setError(err)
				})
				.finally(() => {
					setLoading(false)
				})
		}
	})
	useDeepCompareEffect(() => {
		updateShareData()
	}, [resourceId])

	// 处理密码验证成功
	const handleVerifySuccess = useMemoizedFn((newData: any, password?: string) => {
		applyShareData(newData)
		setError(null)

		// 更新实际验证成功的密码（用于 token polling）
		if (password !== undefined) {
			setVerifiedPassword(password)
		}
	})

	// 处理密码验证失败
	const handleVerifyFail = () => {
		// setError(err)
	}

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Playback_End, (taskData) => {
			const lastTaskStatus = taskData?.process?.[taskData?.process?.length - 1]?.status
			if (!lastTaskStatus) return
			setTaskStatus(lastTaskStatus)
		})
		pubsub.subscribe(PubSubEvents.Playback_Start, () => {
			setTaskStatus("running")
			setHasStarted(true)
		})
		return () => {
			pubsub.unsubscribe(PubSubEvents.Playback_End)
			pubsub.unsubscribe(PubSubEvents.Playback_Start)
		}
	}, [])

	const showWorkspaceButton = useMemo(() => {
		if (isFileShare && isMobile && isLogined) return true
		return !isMobile && isLogined
	}, [isFileShare, isMobile, isLogined])

	const shouldEnterSharedProject = useMemo(() => {
		const currentUserId = toStringId(userInfo?.user_id)
		const creatorUserId = getShareProjectCreatorUserId(data)
		return Boolean(projectId && currentUserId && creatorUserId === currentUserId)
	}, [data, projectId, userInfo?.user_id])

	/** Mounts the dedicated recording share shell only for audio-mode projects. */
	const isAudioProjectShare = useMemo(
		() =>
			Boolean(projectId) &&
			shouldRenderAudioRecordingShareShell({
				projectMode: data?.data?.project_mode,
				attachments,
			}),
		[attachments, data?.data?.project_mode, projectId],
	)
	// Keep ordinary project shares inside Topic so their complete file tree remains navigable.
	const shouldRenderAudioShareShell = isAudioProjectShare
	// Keep the mobile audio share route on the flex height chain so its inner content viewport can scroll.
	const isMobileAudioShareLayout = isMobile && shouldRenderAudioShareShell

	// 是否显示复制项目按钮：旧文件分享 或 allowCopyProjectFiles 为 true 时显示，且用户已登录
	const showCopyProjectButton = useMemo(() => {
		if (!isProjectShare || !isLogined) return false
		// 旧文件分享：始终显示
		if (routeInfo.isLegacy && routeInfo.isFileShare) return true
		// 新格式分享：根据 allowCopyProjectFiles 决定
		return allowCopyProjectFiles
	}, [
		isProjectShare,
		isLogined,
		routeInfo.isLegacy,
		routeInfo.isFileShare,
		allowCopyProjectFiles,
	])

	const showSuperMagicIcon = useMemo(() => {
		if (isFileShare && isMobile) return true
		return !isMobile || (!hasStarted && isMobile)
	}, [isFileShare, isMobile, hasStarted])

	const showMobileFolderButton = useMemo(() => {
		// Legacy shares do not carry the new file-list switch, so keep their mobile entry visible.
		return isMobile && hasStarted && (routeInfo.isLegacy || viewFileList)
	}, [hasStarted, isMobile, routeInfo.isLegacy, viewFileList])

	const isShareDataReady = !isEmpty(data)
	// 检查是否隐藏 header。pure_mode 优先，URL 参数作为老链接兼容。
	const shouldHideHeader = shareDisplayOptions.hideHeader || (isFileShare && !isShareDataReady)
	// The recording detail owns its mobile header, so the outer share shell must not reserve a second header row.
	const isMobileAudioShare = isMobile && shouldRenderAudioShareShell
	const [mobileAudioSharePlayerExpanded, setMobileAudioSharePlayerExpanded] = useState(false)
	const createdByBadgeBottom = useMemo(() => {
		// Keep the default share footer behavior for every scene except the readonly mobile audio shell.
		const defaultBottom = routeInfo.isFileShare || !hasStarted ? "12px" : "64px"
		return resolveMobileAudioShareCreatedByBadgeBottom({
			defaultBottom,
			isMobile,
			shouldRenderAudioShareShell,
			playerExpanded: mobileAudioSharePlayerExpanded,
		})
	}, [
		hasStarted,
		isMobile,
		mobileAudioSharePlayerExpanded,
		routeInfo.isFileShare,
		shouldRenderAudioShareShell,
	])

	const shareAccess = useMemo(() => {
		const token = shareToken || data?.temporary_token || ""
		const nextProjectId =
			projectId || data?.data?.project_id || data?.data?.data?.project_id || ""
		if (!token || !nextProjectId) return null
		return createShareFileAccess({
			token,
			projectId: nextProjectId,
			topicId: resourceId,
			resourceId,
		})
	}, [data, projectId, resourceId, shareToken])

	const waitingForShareAccess =
		!shareAccess &&
		!error &&
		!isNeedPassword &&
		(isFileShare || isProjectShare || !isEmpty(data))

	const handleErrorBack = useMemoizedFn(() => {
		if (!isLogined) {
			const currentHref = window.location.href
			authEventBus.emit(AuthEventName.RequestLogin, {
				reason: "share-access-required",
				source: "share",
				returnTo: currentHref,
				preserveQuery: true,
			})
			return
		}

		// 已登录但没有查看权限：直接回到当前端的首页（桌面 /super、移动 /mobile-home），
		// 不再跳到站点根路由再重定向一次，也避免整页刷新。
		navigate(resolveShareErrorBackNavigation(isMobile))
	})

	const handleWorkspaceButtonClick = useMemoizedFn(async () => {
		if (!shouldEnterSharedProject) {
			history.push({ name: RouteName.Super })
			return
		}

		const workspaceId = getShareProjectWorkspaceId(data)

		try {
			await SuperMagicService.initializeState({
				workspaceId,
				projectId,
			})
		} catch (error) {
			console.error("initialize shared project state failed:", error)
		}

		navigate({
			name: RouteName.SuperWorkspaceProjectState,
			params: {
				projectId,
			},
		})
	})

	const handleCopyProject = useMemoizedFn(() => {
		// 处理查询参数，添加 copyProject=1
		const urlSearchParams = new URLSearchParams(window.location.search)
		urlSearchParams.set("copyProject", "1")

		// 构建新的完整路径
		const newFullPath =
			window.location.origin +
			window.location.pathname +
			"?" +
			urlSearchParams.toString() +
			window.location.hash
		if (!isLogined) {
			authEventBus.emit(AuthEventName.RequestLogin, {
				reason: "share-access-required",
				source: "share",
				returnTo: newFullPath,
				preserveQuery: true,
			})
			return
		}
		console.log("登录过了")
		openCopyProjectModal()
	})

	/** Starts the existing share login flow while preserving the current URL for post-login return. */
	const handleShareLogin = useMemoizedFn(() => {
		authEventBus.emit(AuthEventName.RequestLogin, {
			reason: "manual",
			source: "share",
			returnTo: window.location.href,
			preserveQuery: true,
		})
	})

	useEffect(() => {
		console.log("useMount")
		const urlSearchParams = new URLSearchParams(window.location.search)
		if (urlSearchParams.get("copyProject") && isLogined) {
			openCopyProjectModal()
		}
	}, [isLogined])

	const openCopyProjectModal = () => {
		setIsCopyProjectModalOpen(true)
	}

	// 准备复制项目的数据
	const copyProjectData = useMemo(() => {
		if (!data?.data) return null
		return {
			originalAuthor: data?.data?.extended?.creator,
			originalProjectName: data?.data?.project_name,
			projectId: data.data.project_id,
			defaultNewProjectName: data.data.project_name,
			// 新格式文件分享的参数
			resourceId: resourceId, // 资源ID（用于新接口）
			password: verifiedPassword, // 访问密码
			// 是否为项目分享（通过 share_project 判断）
			isProjectShare: data?.share_project === true,
			// 分享名称（非项目分享时使用）
			shareName: data?.resource_name,
		}
	}, [data, resourceId, verifiedPassword])

	const handleCopySuccess = useMemoizedFn((copiedProject: any, selectedWorkspaceId: string) => {
		// 关闭复制模态框
		setIsCopyProjectModalOpen(false)

		// 保存项目信息并开始显示进度条
		setCopyingProjectId(copiedProject.project_id)
		setCopyingProjectInfo({
			...copiedProject,
			selectedWorkspaceId,
		})
		setShowCopyProgress(true)
	})

	// 进度完成回调（现在用于处理关闭）
	const handleCopyProgressComplete = useMemoizedFn(() => {
		setShowCopyProgress(false)
		setCopyingProjectId("")
		setCopyingProjectInfo(null)
		// setCopyProjectProgress(0)
	})

	// 进度错误回调
	const handleCopyProgressError = useMemoizedFn((error: Error) => {
		console.error("项目复制失败:", error)
		setShowCopyProgress(false)
		setCopyingProjectId("")
		setCopyingProjectInfo(null)

		magicToast.error(`${t("share.copyProjectFailed")}: ${error.message}`)
	})

	const handleCopySharedFilesComplete = useMemoizedFn(
		(info: { projectId: string; workspaceId: string; projectName?: string }) => {
			setCopiedFilesProjectInfo({
				project_id: info.projectId,
				project_name: info.projectName || "",
				workspace_id: info.workspaceId,
				workspace_name: "",
			})
		},
	)

	useEffect(() => {
		// 设置元信息，分享文件/项目
		if (data?.resource_name) {
			setMeta({
				title: `${data?.resource_name}`,
			})
		}
	}, [data?.resource_name, t])

	// ✨ 早期返回：如果需要显示缺省页
	if (emptyStateInfo) {
		return (
			<ShareEmptyState
				currentOrgName={emptyStateInfo.currentOrgName}
				targetOrgName={emptyStateInfo.targetOrgName}
				targetOrgLogo={emptyStateInfo.targetOrgLogo || ""}
				userInfo={emptyStateInfo.userInfo}
				onSwitch={handleSwitchOrganization}
				isLoading={isSwitching}
				isFileShare={isFileShare}
			/>
		)
	}

	// Research topics wrap this replay inside their results view; other topics show it directly.
	const isResearchShare =
		!isFileShare && !isProjectShare && data?.data?.topic_mode === TopicMode.PersonaResearch
	const shareContent = (
		<ShareContent
			isMobile={isMobile}
			data={data}
			attachments={attachments}
			isLogined={isLogined}
			isFileShare={isFileShare || isProjectShare}
			isProjectShare={isProjectShare}
			fileId={fileId}
			defaultOpenFileId={defaultOpenFileId}
			enableImmersiveShareChrome={enableImmersiveShareChrome}
			isImmersiveFullscreen={isImmersiveFullscreen}
			projectId={projectId}
			shareCode={data?.share_code || data?.data?.share_code || resourceId}
			sharePassword={verifiedPassword}
			onCopySharedFilesComplete={handleCopySharedFilesComplete}
			topicId={resourceId}
			showAllProjectFiles={showAllProjectFiles || viewFileList}
			viewFileList={viewFileList}
			showCreatedByBadge={data?.extra?.hide_created_by_super_magic === false}
			allowDownloadProjectFile={allowDownloadProjectFile}
			allowCopyProjectFiles={allowCopyProjectFiles}
			forceFullscreenMode={shareDisplayOptions.forceFullscreenMode}
			documentFlowFullscreen={shareDisplayOptions.documentFlowFullscreen}
			hidePreviewHeader={shareDisplayOptions.hideHeader}
			showFileHeader={shareDisplayOptions.showFileHeader}
			onPreviewFileChange={setCurrentPreviewFileId}
			onPreviewFullscreenChange={setPreviewIsFullscreen}
		/>
	)

	return (
		<FileAccessIdentityProvider value={shareAccess}>
			<div
				className={cn(
					shareDisplayOptions.documentFlowFullscreen
						? "box-border flex min-h-dvh w-full flex-col overflow-visible bg-muted dark:bg-muted"
						: "box-border flex h-full w-screen flex-col overflow-hidden bg-muted dark:bg-muted",
					!isMobileAudioShareLayout &&
						"max-md:block max-md:bg-white max-md:pb-[calc(50px+var(--safe-area-inset-bottom,0px))] dark:max-md:bg-card",
					isMobileAudioShareLayout &&
						"max-md:flex max-md:min-h-0 max-md:bg-white dark:max-md:bg-card",
					isFileShare && "max-md:pb-0",
					!isFileShare && "pb-[50px]",
					isImmersiveFullscreen && "max-md:bg-transparent dark:max-md:bg-transparent",
				)}
				data-testid="share-page-root"
			>
				{copyProjectData && isProjectShare && isLogined && (
					<CopyProjectModal
						open={isCopyProjectModalOpen}
						onCancel={() => setIsCopyProjectModalOpen(false)}
						projectData={copyProjectData}
						onCopySuccess={handleCopySuccess}
					/>
				)}

				{/* 复制项目进度条 */}
				<CopyProjectProgressToast
					projectId={copyingProjectId}
					visible={showCopyProgress}
					projectInfo={copyingProjectInfo}
					onComplete={handleCopyProgressComplete}
					onError={handleCopyProgressError}
					setCopyProjectIsRunning={setCopyProjectIsRunning}
					onProgress={(_progress) => {
						// setCopyProjectProgress(progress)
					}}
					position="top"
				/>
				<CopyProjectProgressToast
					projectId={copiedFilesProjectInfo?.project_id || ""}
					visible={Boolean(copiedFilesProjectInfo)}
					completed
					completedText={t("share.copyFilesCompleted")}
					projectInfo={copiedFilesProjectInfo || undefined}
					onComplete={() => setCopiedFilesProjectInfo(null)}
					position="top"
				/>
				{!isMobileAudioShare && !isImmersiveFullscreen && !shouldHideHeader && (
					<div className={topicContainerBase} data-testid="share-topbar">
						{showSuperMagicIcon ? (
							<Logo className="h-[42px] shrink-0 max-md:h-9" />
						) : null}
						{isMobile && hasStarted && !isFileShare && (
							<div
								className="flex min-w-0 flex-1 items-center gap-2 max-md:gap-1"
								data-testid="share-mobile-topic-info"
							>
								<StatusIcon status={taskStatus as any} />
								<span
									className="min-w-0 flex-1 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal leading-[1.43] text-foreground transition-all duration-200"
									data-testid="share-mobile-title"
								>
									{data?.resource_name || t("messageHeader.untitledTopic")}
								</span>
							</div>
						)}
						{!isMobile && hasStarted && data?.extra?.show_original_info ? (
							<div
								className="ml-[30px] flex min-w-0 flex-1 shrink items-center gap-2.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-foreground/80"
								data-testid="share-original-info"
							>
								<MagicAvatar
									src={data?.creator?.avatar_url || UserAvatar}
									size={24}
								/>
								<span
									className="shrink-0 font-semibold text-foreground/80"
									data-testid="share-creator-name"
								>
									{data?.creator?.nickname || t("common.unknownUser")}
								</span>
								<span className="shrink-0 text-muted-foreground">/</span>
								<span data-testid="share-title">
									{data?.resource_name ||
										(isFileShare
											? t("common.untitledProject")
											: t("messageHeader.untitledTopic"))}
								</span>
							</div>
						) : !isMobile && hasStarted && data?.extra ? (
							<div
								className="ml-[30px] flex min-w-0 flex-1 shrink items-center gap-2.5 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-foreground/80"
								data-testid="share-title-info"
							>
								<span data-testid="share-title">
									{data?.resource_name ||
										(isFileShare
											? t("common.untitledProject")
											: t("messageHeader.untitledTopic"))}
								</span>
							</div>
						) : null}
						<div className="flex gap-2" data-testid="share-topbar-actions">
							{showMobileFolderButton && (
								<Button
									variant="outline"
									size="icon-sm"
									className="h-8 w-8 rounded-lg p-1.5"
									onClick={() => pubsub.publish(PubSubEvents.Folder_Click)}
									data-testid="share-folder-button"
								>
									<IconFolder size={20} />
								</Button>
							)}
							{enableImmersiveShareChrome && (
								<Button
									variant="outline"
									size="icon-sm"
									className="h-8 w-8 rounded-lg p-1.5"
									onClick={() => pubsub.publish(PubSubEvents.Maximize_File)}
									data-testid="share-immersive-fullscreen-button"
								>
									<IconMaximize size={20} />
								</Button>
							)}
							{showCopyProjectButton && (
								<Button
									variant="outline"
									size="sm"
									className="h-8 gap-1.5 rounded-lg border-black/[0.08] px-1.5 py-1.5 dark:border-white/[0.08]"
									onClick={handleCopyProject}
									disabled={copyProjectIsRunning}
									data-testid="share-copy-project-button"
								>
									<IconGitFork size={18} stroke={1.5} className="size-[18px]" />
									<span className="text-sm font-normal leading-5 text-foreground/80">
										{t("share.copyProject")}
									</span>
									<span
										className="inline-flex h-[22px] items-center rounded-[4px] bg-fill px-1.5 py-0.5 text-xs font-bold leading-4 text-foreground"
										data-testid="share-copy-project-count"
									>
										{formatCopyProjectCount(data?.data?.extended?.fork_num)}
									</span>
								</Button>
							)}
							{showWorkspaceButton && !shouldRenderAudioShareShell ? (
								<WorkspaceButton
									label={
										shouldEnterSharedProject
											? t("share.enterProject")
											: t("share.workspace")
									}
									onClick={handleWorkspaceButtonClick}
								/>
							) : null}
							{!isLogined ? (
								<Button
									variant="outline"
									size="sm"
									className="h-8 rounded-lg px-5 py-1.5"
									onClick={handleShareLogin}
									data-testid="share-login-button"
								>
									{t("share.login")}
								</Button>
							) : null}
						</div>
					</div>
				)}
				<div
					className={cn(
						"relative max-md:w-full",
						shareDisplayOptions.documentFlowFullscreen
							? "min-h-dvh overflow-visible"
							: isMobileAudioShareLayout
								? "min-h-0 flex-1 overflow-hidden"
								: "h-full overflow-hidden",
					)}
					data-testid="share-content-container"
				>
					{(loading || waitingForShareAccess) && (
						<div
							className={cn(
								"flex items-center justify-center",
								shareDisplayOptions.documentFlowFullscreen ? "min-h-dvh" : "h-full",
							)}
							data-testid="share-loading"
						>
							<MagicSpin />
						</div>
					)}
					{isNeedPassword && isEmpty(data) && !error && !loading && (
						<PasswordVerification
							resourceId={resourceId}
							initialPassword={passwordFromUrl}
							onVerifySuccess={handleVerifySuccess}
							onVerifyFail={handleVerifyFail}
							getShareData={getShareData}
							isFileShare={routeInfo.isFileShare}
						/>
					)}
					{error && !loading && (
						<ErrorDisplay
							errorMessage={t("share.noPermissionToView")}
							onBack={handleErrorBack}
							isFileShare={routeInfo.isFileShare}
						/>
					)}
					{shareAccess && !error ? (
						shouldRenderAudioShareShell ? (
							isAudioProjectShare ? (
								isMobile ? (
									<ShareMobileAudioRecordingDetailPage
										projectId={projectId}
										resourceName={
											data?.data?.project_name || data?.resource_name
										}
										allowDownloadProjectFile={allowDownloadProjectFile}
										showCopyProject={showCopyProjectButton}
										copyProjectLabel={t("share.copyProject")}
										showLogin={!isLogined}
										loginLabel={t("share.login")}
										onCopyProject={handleCopyProject}
										onLogin={handleShareLogin}
										attachments={attachments}
										onPlayerExpandedChange={setMobileAudioSharePlayerExpanded}
									/>
								) : (
									<RecordingDetailShareDesktop
										projectId={projectId}
										resourceName={
											data?.data?.project_name || data?.resource_name
										}
										allowDownloadProjectFile={allowDownloadProjectFile}
										attachments={attachments}
									/>
								)
							) : null
						) : isResearchShare ? (
							<Suspense fallback={<MagicSpin />}>
								<ResearchShareView
									topicId={resourceId}
									topicName={data?.resource_name || ""}
									projectId={projectId || data?.data?.project_id || ""}
									projectName={data?.data?.project_name || ""}
									attachments={attachments}
									access={shareAccess}
									isMobile={isMobile}
									replay={shareContent}
								/>
							</Suspense>
						) : (
							shareContent
						)
					) : null}
				</div>
				{/* 由超级麦吉创造按钮：默认不显示，只有 hide_created_by_super_magic 为 false 时才显示 */}
				<CreatedByBadge
					visible={
						!isImmersiveFullscreen && data?.extra?.hide_created_by_super_magic === false
					}
					style={{ bottom: createdByBadgeBottom }}
				/>
			</div>
		</FileAccessIdentityProvider>
	)
}

export default function FileAccessPage() {
	return (
		<FilePermissionsProvider>
			<Share />
		</FilePermissionsProvider>
	)
}
