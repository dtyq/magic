import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import TopicFilesCore, {
	TopicFilesCoreRef,
} from "@/pages/superMagic/components/TopicFilesButton/TopicFilesCore"
import Detail, { DetailRef } from "@/pages/superMagic/components/Detail"
import LoadingMessage from "@/pages/superMagic/components/LoadingMessage"
import TaskList from "../TaskList"
import ReplayLogo from "@/pages/share/assets/icon/replay_logo.svg"
import PreviewDetailPopup from "@/pages/superMagicMobile/components/PreviewDetailPopup/index"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import {
	getAppEntryFile,
	isMagicProjectConfigFile,
	resolveMagicProjectAttachment,
} from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { detectContentTypeRender } from "@/pages/superMagic/components/Detail/components/FilesViewer/utils/preview"
import { IconFolder, IconLayoutGrid, IconLogin, IconPlayerPlayFilled } from "@tabler/icons-react"
import { MagicTooltip } from "@/components/base"
import { Slider } from "@/components/shadcn-ui/slider"
import { Button } from "@/components/shadcn-ui/button"
import { Popup, SafeArea } from "antd-mobile"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import { isEmpty } from "lodash-es"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import useFullscreenMode from "@/hooks/useFullscreenMode"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import MessageList from "../MessageList"
import {
	MessageStatus,
	TaskStatus,
	type ProjectListItem,
	type TaskData,
} from "@/pages/superMagic/pages/Workspace/types"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import { useDownloadAll } from "@/pages/superMagic/components/TopicFilesButton/useDownloadAll"
import { getBaseUrl } from "@/pages/superMagicMobile/utils/mobile"
import { useTranslation } from "react-i18next"
import ProjectSider from "@/pages/superMagic/components/ProjectSider"
import BackToLatestButton from "@/pages/superMagic/components/MessageList/components/BackToLatestButton"
import type { MessageListScrollAdapter } from "@/pages/superMagic/components/MessageList/message-list-scroll-adapter"
import { filterPanelMessage } from "@/pages/superMagic/utils/handleMessage"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"
import { messagesTransformer } from "../MessageList/utils"
import { observer } from "mobx-react-lite"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"
import FooterLogo from "./components/FooterLogo"
import useResizablePanel from "@/pages/superMagic/hooks/useResizablePanel"
import ResizableDivider from "@/pages/superMagic/components/ResizableDivider"
import {
	PROJECT_SIDER_WIDTH_STORAGE_KEY,
	MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	DEFAULT_MIN_WIDTH,
	DEFAULT_MAX_WIDTH,
	DEFAULT_WIDTH,
} from "@/pages/superMagic/constants/resizablePanel"
import { cn } from "@/utils/cn"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { ProjectFilesStore } from "@/stores/projectFiles"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import { calculateDefaultOpenFileId } from "@/pages/superMagic/components/Share/FileSelector/utils"
import { useShareMenuFilters } from "../../hooks"
import type { CrossProjectOperationSuccessResult } from "@/pages/superMagic/components/TopicFilesButton/hooks/useCrossProjectFileOperation"

const SHARE_MESSAGE_TOP_MASK_CLASS_NAME =
	"pointer-events-none absolute inset-x-0 top-0 z-10 h-2.5 bg-white dark:bg-card"

function Topic({
	data,
	resource_name,
	isMobile,
	attachments,
	isLogined,
	isFileShare,
	fileId,
	defaultOpenFileId,
	enableImmersiveShareChrome,
	isImmersiveFullscreen,
	topicId,
	projectId,
	shareCode,
	sharePassword,
	onCopySharedFilesComplete,
	showAllProjectFiles,
	viewFileList,
	showCreatedByBadge,
	allowDownloadProjectFile,
	allowCopyProjectFiles = false,
	forceFullscreenMode,
	documentFlowFullscreen,
	hidePreviewHeader,
	showFileHeader,
	onPreviewFileChange,
	onPreviewFullscreenChange,
}: {
	data: any
	resource_name: string
	isMobile: boolean
	attachments: any
	isLogined: boolean
	isFileShare?: boolean
	fileId?: string
	defaultOpenFileId?: string
	enableImmersiveShareChrome?: boolean
	isImmersiveFullscreen?: boolean
	topicId?: string
	projectId?: string
	shareCode?: string
	sharePassword?: string
	onCopySharedFilesComplete?: (info: {
		projectId: string
		workspaceId: string
		projectName?: string
	}) => void
	showAllProjectFiles?: boolean
	isProjectShare?: boolean
	viewFileList?: boolean
	showCreatedByBadge?: boolean
	allowDownloadProjectFile?: boolean
	allowCopyProjectFiles?: boolean
	forceFullscreenMode?: boolean
	documentFlowFullscreen?: boolean
	hidePreviewHeader?: boolean
	showFileHeader?: boolean
	onPreviewFileChange?: (fileId: string | null) => void
	onPreviewFullscreenChange?: (isFullscreen: boolean) => void
}) {
	const { t } = useTranslation("super")
	const isUrlFullscreenMode = useFullscreenMode()
	const isFullscreenMode = Boolean(forceFullscreenMode) || isUrlFullscreenMode

	const [taskData, setTaskData] = useState<TaskData | null>(null)
	const previewDetailPopupRef = useRef(null) as any
	const manualFilePopupRef = useRef(null) as any // 用于手动选择文件的 Popup
	const [messageList, setMessageList] = useState<any[]>([])
	const [autoDetail, setAutoDetail] = useState<any>(null)
	const [userDetail, setUserDetail] = useState<any>(null)
	const timerRef = useRef<any>({})
	const messageContainerRef = useRef<HTMLDivElement>(null)
	const [taskIsEnd, setTaskIsEnd] = useState(false)
	const [isBottom, setIsBottom] = useState(false)
	const [attachmentVisible, setAttachmentVisible] = useState(false)
	const [hasStarted, setHasStarted] = useState(false)
	const [countdown, setCountdown] = useState(10)
	const detailRef = useRef<DetailRef>(null)
	const topicFilesCoreRef = useRef<TopicFilesCoreRef>(null)
	const [sliderValue, setSliderValue] = useState(0)
	const [showBackToLatest, setShowBackToLatest] = useState(false)
	// Add activeFileId state management same as workspace
	const [activeFileId, setActiveFileId] = useState<string | null>(null)
	const [primaryPreviewFileId, setPrimaryPreviewFileId] = useState<string | null>(null)

	const [projectFilesStore] = useState(() => new ProjectFilesStore())

	const { handleDownloadAll, allLoading } = useDownloadAll({ projectId })

	const { isShareRoute, isLegacy } = useShareRoute()
	const shareSelectedProject = useMemo(
		() =>
			projectId
				? ({
						id: projectId,
						project_name: resource_name,
						name: resource_name,
					} as ProjectListItem)
				: null,
		[projectId, resource_name],
	)

	// 判断是否是新格式文件分享（多个文件，无fileId）
	const isNewFileShare = isFileShare && !fileId
	const shouldRenderFullscreenFileOnly = isFullscreenMode && Boolean(isFileShare) && !isMobile

	// 使用分享页面菜单过滤 Hook
	const allowCopySharedFiles = isLogined && allowCopyProjectFiles
	const { filterShareMenuItems, filterBatchDownloadLayerMenuItems } = useShareMenuFilters({
		allowDownloadProjectFile,
		allowCopyProjectFile: allowCopySharedFiles,
	})
	const handleCrossProjectOperationSuccess = useMemoizedFn(
		(result: CrossProjectOperationSuccessResult) => {
			if (
				result.operationType !== "copy" ||
				!result.targetProjectId ||
				!result.targetWorkspaceId
			) {
				return
			}

			onCopySharedFilesComplete?.({
				projectId: result.targetProjectId,
				workspaceId: result.targetWorkspaceId,
				projectName: result.targetProjectName,
			})
		},
	)

	// 判断是否需要调整 BackToLatestButton 的位置
	// BackToLatestButton 只在话题分享场景显示，当 Badge 也显示时，需要上移按钮避免遮挡
	const needAdjustButtonPosition = showCreatedByBadge && !isFileShare

	// Hover 状态管理
	const [isProjectSiderHovering, setIsProjectSiderHovering] = useState(false)
	const [isMessagePanelHovering, setIsMessagePanelHovering] = useState(false)

	// ProjectSider 宽度管理（与 TopicPage/ProjectPage 共享 storageKey）
	const {
		width: projectSiderWidth,
		isDragging: isProjectSiderDragging,
		handleResizeStart: handleProjectSiderResizeStart,
	} = useResizablePanel({
		minWidth: DEFAULT_MIN_WIDTH.PROJECT_SIDER,
		maxWidth: DEFAULT_MAX_WIDTH.PROJECT_SIDER,
		defaultWidth: DEFAULT_WIDTH.PROJECT_SIDER,
		storageKey: PROJECT_SIDER_WIDTH_STORAGE_KEY,
		direction: "left", // 向左拖拽增加宽度（右侧边框）
	})

	// 消息面板宽度管理（与 TopicPage 共享 storageKey）
	const {
		width: messagePanelWidth,
		isDragging: isMessagePanelDragging,
		handleResizeStart: handleMessagePanelResizeStart,
	} = useResizablePanel({
		minWidth: DEFAULT_MIN_WIDTH.MESSAGE_PANEL,
		maxWidth: DEFAULT_MAX_WIDTH.MESSAGE_PANEL,
		defaultWidth: DEFAULT_WIDTH.MESSAGE_PANEL,
		storageKey: MESSAGE_PANEL_WIDTH_STORAGE_KEY,
	})

	// const setMessageList = (list: any[]) => {
	// 	console.log("@---->", topicId, list)
	// 	superMagicStore.setShareMessage(topicId, list)
	// 	setMessageLists(
	// 		(list || [])?.map((o) => {
	// 			return {
	// 				...o,
	// 				magic_message_id: o?.message_id,
	// 				app_message_id: o?.message_id,
	// 				topic_id: o?.topic_id,
	// 				type: o?.type,
	// 				send_time: o?.send_timestamp,
	// 				status: o?.status,
	// 				event: o?.event,
	// 				debug: o?.[o?.type],
	// 				correlation_id: o?.correlation_id,
	// 				role: o?.role || "user",
	// 				seq_id: o?.message_id,
	// 			}
	// 		}),
	// 	)
	// }

	const handlePreviewDetail = useMemoizedFn((item: any) => {
		setPrimaryPreviewFileId(item?.currentFileId || null)
		previewDetailPopupRef.current?.open(item, attachments.tree, attachments.list)
	})

	const messagesWithoutRevoked = useMemo(() => {
		if (!data?.list?.length) {
			return data?.list
		}
		const _revokedMessageIndex = data.list.findIndex(
			(item: any) => item?.im_status === MessageStatus.REVOKED,
		)
		const revokedMessageIndex =
			_revokedMessageIndex !== -1 ? _revokedMessageIndex : data.list.length
		return data.list.slice(0, revokedMessageIndex)
	}, [data])

	const updateDataWithValue = useMemoizedFn((value: number) => {
		if (!messagesWithoutRevoked?.length) return

		const clampedIndex = Math.max(0, Math.min(value, messagesWithoutRevoked.length))
		const targetMessages = messagesWithoutRevoked.slice(0, clampedIndex)
		setMessageList(messagesTransformer(targetMessages))
		setUserDetail(null)

		if (targetMessages.length > 0) {
			const lastTaskMessage = [...targetMessages]
				.reverse()
				.find((msg) => msg?.steps && msg?.steps?.length > 0)
			if (lastTaskMessage?.steps)
				setTaskData({
					process: lastTaskMessage.steps,
					topic_id: lastTaskMessage.topic_id,
				})

			const lastDetailMessage = [...targetMessages]
				.reverse()
				.find((msg) => filterPanelMessage(msg))
			if (filterPanelMessage(lastDetailMessage))
				setAutoDetail({
					...lastDetailMessage.tool.detail,
					id: lastDetailMessage.tool.id,
					name: lastDetailMessage.tool.name,
				})
			if (isMobile && filterPanelMessage(lastDetailMessage)) {
				handlePreviewDetail({
					...lastDetailMessage.tool.detail,
					id: lastDetailMessage.tool.id,
					name: lastDetailMessage.tool.name,
					isFromNode: true,
				})
			}
		} else {
			setTaskData(null)
			setAutoDetail({})
		}

		setIsBottom(clampedIndex >= messagesWithoutRevoked.length)
		setHasStarted(true)
		// 移除强制滚动，让 useLayoutEffect 来处理滚动逻辑
	})

	const { run: debouncedUpdateData } = useDebounceFn(updateDataWithValue, {
		wait: 300,
	})

	// 处理进度条拖拽中
	const handleSliderChange = useCallback(
		(value: number) => {
			// 清除所有定时器
			if (timerRef.current.timer) clearInterval(timerRef.current.timer)
			if (timerRef.current.countdownTimer) clearInterval(timerRef.current.countdownTimer)

			// 立即更新slider的值，保持UI响应
			setSliderValue(value)
			// 防抖更新实际数据
			debouncedUpdateData(value)
		},
		[debouncedUpdateData],
	)

	// 从当前进度继续播放
	const resumePlay = useCallback(() => {
		if (!messagesWithoutRevoked?.length) return

		// 清除现有定时器
		if (timerRef.current.timer) clearInterval(timerRef.current.timer)

		// 从当前messageList长度开始播放
		let currentIndex = messageList.length

		// 如果已经播放完了，就不需要继续播放
		if (currentIndex >= messagesWithoutRevoked.length) return

		timerRef.current.timer = setInterval(() => {
			if (currentIndex < messagesWithoutRevoked.length) {
				const newMessage = messagesWithoutRevoked[currentIndex]
				if (filterPanelMessage(newMessage)) {
					setAutoDetail?.({
						...newMessage?.tool?.detail,
						id: newMessage?.tool?.id,
						name: newMessage?.tool?.name,
					})
					// 移动端，更新detail
					if (isMobile && !userDetail) {
						previewDetailPopupRef.current?.onlyUpdateDetail(
							{
								...newMessage?.tool?.detail,
								id: newMessage?.tool?.id,
								isFromNode: true,
							},
							attachments.tree,
							attachments.list,
						)
					}
				}
				setMessageList((pre) => [...pre, ...messagesTransformer([newMessage])])
				currentIndex += 1
			} else {
				clearInterval(timerRef.current.timer)
			}
		}, 400)
	}, [
		messagesWithoutRevoked,
		messageList.length,
		isMobile,
		userDetail,
		attachments.tree,
		attachments.list,
	])

	// 处理进度条拖拽完成
	const handleSliderChangeComplete = useCallback(
		(value: number) => {
			// 拖拽完成后，如果还没播放完，就继续播放
			if (value < messagesWithoutRevoked.length) {
				resumePlay()
			}
		},
		[messagesWithoutRevoked.length, resumePlay],
	)

	// 同步messageList长度到sliderValue
	useEffect(() => {
		setSliderValue(messageList.length)
	}, [messageList.length])

	// 初始加载前10条消息
	useEffect(() => {
		if (messagesWithoutRevoked?.length) {
			// 只加载前10条消息，或者如果总条数少于10则全部加载
			const initialCount = Math.min(10, messagesWithoutRevoked.length)
			const initialMessages = messagesWithoutRevoked.slice(0, initialCount)
			setMessageList(messagesTransformer(initialMessages))
		}
	}, [messagesWithoutRevoked])

	const play = useCallback(() => {
		pubsub.publish(PubSubEvents.Playback_Start)
		setIsBottom(false)
		// 确保清除任何现有的定时器
		if (timerRef.current.timer) {
			clearInterval(timerRef.current.timer)
		}
		// 从头开始加载消息
		let currentIndex = 0
		timerRef.current.timer = setInterval(() => {
			if (currentIndex < messagesWithoutRevoked.length) {
				const newMessage = messagesWithoutRevoked[currentIndex]
				if (filterPanelMessage(newMessage)) {
					setAutoDetail?.({
						...newMessage?.tool?.detail,
						id: newMessage?.tool?.id,
						name: newMessage?.tool?.name,
					})
					// 移动端，更新detail
					if (isMobile && !userDetail) {
						previewDetailPopupRef.current?.onlyUpdateDetail(
							{
								...newMessage?.tool?.detail,
								id: newMessage?.tool?.id,
								name: newMessage?.tool?.name,
								isFromNode: true,
							},
							attachments.tree,
							attachments.list,
						)
					}
				}
				setMessageList((pre) => [...pre, ...messagesTransformer([newMessage])])
				currentIndex += 1
			} else {
				clearInterval(timerRef.current.timer)
			}
		}, 400)
	}, [messagesWithoutRevoked])

	// 处理开始显示消息
	const startShowingMessages = useCallback(() => {
		pubsub.publish(PubSubEvents.Playback_Start)
		setMessageList([])
		setHasStarted(true)
		play()
	}, [play])

	const isLoadAll = useMemo(() => {
		return messageList.length === messagesWithoutRevoked.length
	}, [messageList, messagesWithoutRevoked])

	// 倒计时自动开始显示
	useEffect(() => {
		if (hasStarted || !messagesWithoutRevoked?.length) return undefined

		// 清除任何现有的定时器
		if (timerRef.current.countdownTimer) {
			clearInterval(timerRef.current.countdownTimer)
		}

		timerRef.current.countdownTimer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timerRef.current.countdownTimer)
					startShowingMessages()
					return 0
				}
				return prev - 1
			})
		}, 1000)

		return () => {
			if (timerRef.current.countdownTimer) {
				clearInterval(timerRef.current.countdownTimer)
			}
		}
	}, [messagesWithoutRevoked, hasStarted, startShowingMessages, messageList])

	// 分享话题里的消息预览也要复用统一打开文件事件；桌面走 Detail，移动端走预览弹层。
	useEffect(() => {
		const handleOpenFileTab = (openFileTabData: { fileId?: string; fileData?: any }) => {
			const filePayload = openFileTabData?.fileData || {
				file_id: openFileTabData?.fileId || "",
			}

			// 使用 setTimeout 确保 DOM 更新后再打开预览，和工作台保持同一时序。
			setTimeout(() => {
				if (isMobile) {
					const currentFileId =
						filePayload?.file_id || filePayload?.id || filePayload?.currentFileId || ""
					const fileName =
						filePayload?.display_filename ||
						filePayload?.file_name ||
						filePayload?.filename ||
						filePayload?.name ||
						""
					const contentTypeConfig = detectContentTypeRender(filePayload)
					const type =
						contentTypeConfig?.detailType ||
						getFileType(filePayload?.file_extension || "")

					if (!currentFileId || !type || type === "notSupport") return

					handlePreviewDetail({
						type,
						data: contentTypeConfig?.dataTransformer
							? {
									...filePayload,
									file_id: currentFileId,
									file_name: fileName,
									...contentTypeConfig.dataTransformer(filePayload),
								}
							: {
									...filePayload,
									file_id: currentFileId,
									file_name: fileName,
								},
						currentFileId,
					})
					return
				}

				detailRef.current?.openFileTab?.(filePayload)
			}, 100)
		}

		const handleOpenPlaybackTab = (toolData: any) => {
			// 打开playback tab，用户主动点击时应该强制激活
			setTimeout(() => {
				detailRef.current?.openPlaybackTab?.({ toolData, forceActivate: true })
			}, 100)
		}

		pubsub?.subscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
		pubsub?.subscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_File_Tab, handleOpenFileTab)
			pubsub.unsubscribe(PubSubEvents.Open_Playback_Tab, handleOpenPlaybackTab)
		}
	}, [handlePreviewDetail, isMobile])

	// 分享场景初始化时自动打开playback tab
	useEffect(() => {
		// 确保消息列表已加载且不是文件分享场景
		if (!isFileShare && messageList.length > 0 && detailRef.current) {
			// 检查是否有工具调用消息
			const hasToolMessages = messageList.some((msg) => filterPanelMessage(msg))
			if (hasToolMessages) {
				// 延迟打开，确保Detail组件已完全初始化
				// 使用默认行为：如果没有激活的文件tab则激活playbackTab
				setTimeout(() => {
					detailRef.current?.openPlaybackTab?.()
				}, 100)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [messageList.length, isFileShare])

	// 清理定时器
	useEffect(() => {
		return () => {
			if (timerRef.current.timer) {
				clearInterval(timerRef.current.timer)
			}
			if (timerRef.current.countdownTimer) {
				clearInterval(timerRef.current.countdownTimer)
			}
		}
	}, [])

	// Clear activeFileId when projectId or topicId changes
	useEffect(() => {
		setActiveFileId(null)
	}, [projectId])

	// Sync attachments into projectFilesStore so ToolCall and TopicFilesCore can reuse the
	// store list path instead of re-flattening the full tree on every incremental commit.
	useEffect(() => {
		if (attachments?.tree && attachments.tree.length > 0) {
			projectFilesStore.setWorkspaceFileTree(attachments.tree, {
				list: attachments.list,
				source: "ShareTopic.attachments",
			})
		} else {
			projectFilesStore.setWorkspaceFileTree([])
		}
	}, [attachments?.tree, attachments?.list])

	const isAtBottomRef = useRef(true) // 👈 用 ref 保存旧的 isAtBottom 状态
	const virtualizerRef = useRef<MessageListScrollAdapter | null>(null)

	/**
	 * Ask the virtualizer for the scroll end rather than writing `scrollHeight` ourselves. That
	 * height only covers the rows virtua has measured; the rest of its canvas is an estimate that
	 * keeps growing, so a raw write lands short and nothing follows up. `scrollToIndex` re-derives
	 * the target from the measurement cache on every measurement pass until the sizes settle.
	 */
	const scrollToLatest = useMemoizedFn(() => {
		const virtualizer = virtualizerRef.current
		const lastIndex = virtualizer ? virtualizer.itemCount - 1 : -1
		if (virtualizer && lastIndex >= 0) {
			virtualizer.scrollToIndex(lastIndex, { align: "end" })
			return
		}
		// Before the virtualizer mounts there is nothing to address, and the canvas is still
		// whatever the shell rendered itself.
		messageContainerRef.current?.scrollTo({ top: messageContainerRef.current.scrollHeight })
	})

	/**
	 * The list mounts one render after this shell, because its virtualizer needs the scroll
	 * element that only exists once we have committed. Every scroll issued before that reaches an
	 * empty canvas, and no state change follows to retry it, so re-issue from the canvas itself:
	 * this fires when the virtualizer first renders rows and again as their measurements land.
	 */
	const handleVirtualizerChange = useMemoizedFn(() => {
		if (isAtBottomRef.current) scrollToLatest()
	})

	const releaseFollow = useMemoizedFn(() => {
		if (!isAtBottomRef.current) return
		isAtBottomRef.current = false
		setShowBackToLatest(true)
	})

	useEffect(() => {
		const el = messageContainerRef.current
		if (!el) return undefined

		/**
		 * Re-arm only. Distance from the bottom also grows when virtua measures a row taller than
		 * it estimated, and treating that as "the reader left the bottom" latches the follow off
		 * for the rest of the playback.
		 */
		const handleScroll = () => {
			const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
			if (distanceFromBottom >= 30) return
			isAtBottomRef.current = true
			setShowBackToLatest(false)
		}

		// Leaving the bottom is a decision, so take it from the gesture that made it.
		const handleWheel = (event: WheelEvent) => {
			if (event.deltaY < 0) releaseFollow()
		}
		let touchY = 0
		const handleTouchStart = (event: TouchEvent) => {
			touchY = event.touches[0]?.clientY ?? 0
		}
		const handleTouchMove = (event: TouchEvent) => {
			const y = event.touches[0]?.clientY ?? 0
			if (y > touchY) releaseFollow()
			touchY = y
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home") {
				releaseFollow()
			}
		}

		el.addEventListener("scroll", handleScroll, { passive: true })
		el.addEventListener("wheel", handleWheel, { passive: true })
		el.addEventListener("touchstart", handleTouchStart, { passive: true })
		el.addEventListener("touchmove", handleTouchMove, { passive: true })
		el.addEventListener("keydown", handleKeyDown)
		return () => {
			el.removeEventListener("scroll", handleScroll)
			el.removeEventListener("wheel", handleWheel)
			el.removeEventListener("touchstart", handleTouchStart)
			el.removeEventListener("touchmove", handleTouchMove)
			el.removeEventListener("keydown", handleKeyDown)
		}
	}, [hasStarted, releaseFollow])

	// 👇 2. 在 DOM 完成渲染后再判断要不要滚到底部
	useLayoutEffect(() => {
		if (isAtBottomRef.current) scrollToLatest()
	}, [messageList, scrollToLatest]) // 👈 注意：这里不能再判断 isScrolledToBottom，而是用之前记录的 isAtBottomRef

	useEffect(() => {
		if (messageList.length === messagesWithoutRevoked?.length) {
			setIsBottom(true)
		}
	}, [messageList.length, messagesWithoutRevoked?.length, taskData])

	// 当消息列表变化时，查找最后一条有task且task.process长度不为0的消息
	useEffect(() => {
		if (messageList && messageList.length > 0) {
			// 从后往前遍历找到第一个符合条件的消息
			let foundTaskData = false
			for (let i = messageList.length - 1; i >= 0; i -= 1) {
				const message = messageList[i]
				if (message?.steps && message?.steps?.length > 0) {
					// 设置为当前任务数据
					const newTaskData = {
						process: message.steps,
						topic_id: message.topic_id,
					}
					setTaskData(newTaskData)
					// 发布任务结束事件
					if (
						message?.steps?.every?.(
							(step: any) => step?.status === "finished" || step?.status === "error",
						)
					) {
						pubsub.publish(PubSubEvents.Playback_End, newTaskData)
					}
					foundTaskData = true
					break
				}
			}
			// 如果没有找到符合条件的消息，清空TaskData
			if (!foundTaskData) {
				setTaskData(null)
			}
			const lastMessageWithTaskId = messageList
				.slice()
				.reverse()
				.find((message) => message.role === "assistant")
			const lastMessage = messageList[messageList.length - 1]
			const isLoading =
				lastMessageWithTaskId?.status === "running" || lastMessage?.text?.content
			setTaskIsEnd(!isLoading)
		} else {
			// 如果消息列表为空，也清空TaskData
			setTaskData(null)
		}
	}, [messageList])

	const scrollToBottom = useMemoizedFn(() => {
		isAtBottomRef.current = true
		setShowBackToLatest(false)
		scrollToLatest()
	})

	// 直接显示结果的处理：立即加载所有消息，停止倒计时
	const handleShowResult = useMemoizedFn(() => {
		pubsub.publish(PubSubEvents.Playback_Start)
		setUserDetail(null)
		setHasStarted(true)
		// 查找所有消息中带有详情的最后一条
		const lastDetailItem = [...messagesWithoutRevoked]
			.reverse()
			.find((item) => filterPanelMessage(item))
		if (lastDetailItem && !isFileShare) {
			setAutoDetail({
				...lastDetailItem.tool.detail,
				id: lastDetailItem.tool.id,
				name: lastDetailItem.tool.name,
			})
		}

		// 清除所有定时器
		if (timerRef.current.timer) {
			clearInterval(timerRef.current.timer)
		}
		if (timerRef.current.countdownTimer) {
			clearInterval(timerRef.current.countdownTimer)
		}

		// 一次性设置所有消息
		setMessageList(messagesTransformer(messagesWithoutRevoked))

		// 滚动到底部
		requestAnimationFrame(() => {
			scrollToBottom()
		})
		setIsBottom(true)
	})

	// Handle file sharing mode
	// 旧格式文件分享（有fileId）：自动打开并最大化指定文件
	// 新格式文件分享（无fileId）：如果有defaultOpenFileId，自动打开指定文件；否则只显示消息列表
	useEffect(() => {
		// 确定要打开的文件ID：旧格式用fileId，新格式用defaultOpenFileId
		let targetFileId = fileId || defaultOpenFileId

		if (!targetFileId) {
			const levelOneFile = attachments?.tree?.map?.((item: any) => item.file_id) || []
			const firstFileId = calculateDefaultOpenFileId(levelOneFile, attachments?.tree || [])
			targetFileId = firstFileId || ""
		}

		// 新格式文件分享：只显示消息列表，如果有defaultOpenFileId则自动打开文件
		if (isNewFileShare && handleShowResult) {
			handleShowResult()
			// 如果没有要打开的文件，直接返回
			if (!targetFileId) {
				return
			}
		}

		// 旧格式文件分享：自动打开并最大化指定文件
		if (fileId && (isFileShare || messagesWithoutRevoked?.length) && handleShowResult) {
			handleShowResult()
		}

		// 如果有要打开的文件ID，执行打开逻辑（新旧格式共用）
		// 需要等待 attachments.tree 加载完成
		if (
			targetFileId &&
			attachments?.tree &&
			attachments.tree.length > 0 &&
			handlePreviewDetail
		) {
			// Find the file in attachments and set it as user detail
			const findFileInAttachments = (attachmentTree: any): any => {
				if (!attachmentTree) return null

				for (const item of attachmentTree) {
					if (item.file_id === targetFileId || item.id === targetFileId) {
						return item
					}
					if (item.children) {
						const found = findFileInAttachments(item.children)
						if (found) return found
					}
				}
				return null
			}

			const targetFile = findFileInAttachments(attachments.tree)
			if (targetFile) {
				const targetFileName =
					targetFile.display_filename || targetFile.file_name || targetFile.filename
				const magicProjectResolution = isMagicProjectConfigFile(targetFileName)
					? resolveMagicProjectAttachment(
							targetFile,
							attachments.list || [],
							attachments.tree || [],
						)
					: undefined
				const resolvedProjectDirectory = magicProjectResolution?.projectDirectory
				// 检查是否是文件夹且有 metadata.type
				const isFolder =
					resolvedProjectDirectory?.is_directory ||
					resolvedProjectDirectory?.children?.length ||
					targetFile.is_directory ||
					(targetFile.children && targetFile.children.length > 0)
				let fileToOpen = resolvedProjectDirectory || targetFile

				// 如果是文件夹且有 metadata.type，获取入口文件
				if (!resolvedProjectDirectory && isFolder && targetFile.display_config?.type) {
					const entryFile = getAppEntryFile(
						targetFile.children || [],
						targetFile.display_config,
					)
					if (entryFile) {
						fileToOpen = entryFile
					}
				}

				const fileName =
					fileToOpen.display_filename || fileToOpen.file_name || fileToOpen.filename

				// 先检查是否有内容类型渲染配置（如 design 类型）
				const contentTypeConfig = detectContentTypeRender(fileToOpen)
				let type: string | null = null
				let fileData: any = {
					file_name: fileName,
					file_extension: fileToOpen.file_extension,
					file_size: fileToOpen.file_size,
					file_id: fileToOpen.file_id || fileToOpen.id,
					display_config: fileToOpen?.display_config,
				}

				if (contentTypeConfig) {
					// 使用内容类型渲染配置
					type = contentTypeConfig.detailType
					// 使用数据转换器转换数据
					if (contentTypeConfig.dataTransformer) {
						fileData = {
							...fileData,
							...contentTypeConfig.dataTransformer(fileToOpen),
						}
					}
				} else {
					// 没有内容类型配置，使用文件扩展名判断
					type = getFileType(fileToOpen.file_extension)
				}

				if (type && type !== "notSupport") {
					const fileDetail = {
						type, // 根据内容类型配置或文件扩展名确定类型
						data: fileData,
						currentFileId: fileToOpen.file_id || fileToOpen.id,
						attachments: attachments.tree,
					}

					if (isMobile) {
						// 移动端：调用handlePreviewDetail打开弹层
						handlePreviewDetail(fileDetail)
					} else {
						// PC端：直接设置Detail并打开文件tab
						if (isFileShare) {
							const openFileTab = () => {
								detailRef.current?.openFileTab(fileToOpen)
							}

							if (shouldRenderFullscreenFileOnly) {
								requestAnimationFrame(openFileTab)
							} else {
								setTimeout(openFileTab, 100)
							}
						} else {
							setUserDetail(fileDetail)
							pubsub.publish(PubSubEvents.Maximize_File)
						}
					}
				} else {
					const emptyDetail = {
						type: "empty",
						data: {
							text: "暂不支持预览该文件,请下载该文件",
						},
					}

					if (isMobile) {
						handlePreviewDetail(emptyDetail)
					} else {
						setUserDetail(emptyDetail)
					}
				}
			}
		}
	}, [
		isNewFileShare,
		isFileShare,
		fileId,
		defaultOpenFileId,
		data,
		attachments,
		handleShowResult,
		isMobile,
		handlePreviewDetail,
		showAllProjectFiles,
		detailRef,
		messagesWithoutRevoked?.length,
		shouldRenderFullscreenFileOnly,
	])

	const replay = useCallback(() => {
		// 重置状态
		setMessageList([])
		setAutoDetail(null)
		setTaskData(null)

		// 清除现有定时器
		if (timerRef.current.timer) {
			clearInterval(timerRef.current.timer)
		}
		if (timerRef.current.countdownTimer) {
			clearInterval(timerRef.current.countdownTimer)
		}

		// 立即开始播放
		play()
	}, [play])

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Folder_Click, () => {
			setAttachmentVisible(true)
		})
		return () => {
			pubsub.unsubscribe(PubSubEvents.Folder_Click)
		}
	}, [])

	const baseShareUrl = useMemo(() => {
		return `${getBaseUrl()}/share`
	}, [])

	// 判断是否显示项目文件栏
	const shouldShowProjectSider = useMemo(() => {
		const isNewTopicShare = isShareRoute && !isLegacy
		if (shouldRenderFullscreenFileOnly) {
			return false
		}

		// 如果 viewFileList 为 false，则不显示项目文件栏（仅对新分享格式生效）
		if (viewFileList === false && (isNewFileShare || isNewTopicShare)) {
			return false
		}

		// 移动端不显示项目文件栏
		if (isMobile) {
			return false
		}

		// 新文件分享：仅在桌面端显示
		if (isNewFileShare || isFileShare) {
			return true
		}

		// 其他情况：使用原有逻辑
		// 隐藏条件：
		// 1. 任务数据为空且附件树为空
		// 2. 自动详情和用户详情都为空
		// 且不满足显示条件：showAllProjectFiles 为 true
		const shouldHide =
			(isEmpty(attachments.tree) || isEmpty(autoDetail || userDetail)) && !showAllProjectFiles

		return !shouldHide
	}, [
		isNewFileShare,
		isMobile,
		attachments.tree,
		autoDetail,
		userDetail,
		isFileShare,
		showAllProjectFiles,
		viewFileList,
		shouldRenderFullscreenFileOnly,
	])

	return (
		<>
			{/* Anchor the absolute resize dividers to this share viewport. */}
			<div
				className={cn(
					documentFlowFullscreen
						? "relative flex min-h-dvh w-full flex-row justify-center overflow-visible bg-transparent"
						: "relative flex h-full w-full flex-row justify-center overflow-hidden bg-transparent",
				)}
			>
				{isMobile ? (
					<>
						<PreviewDetailPopup
							ref={previewDetailPopupRef}
							setUserSelectDetail={(detail) => {
								handlePreviewDetail(detail)
							}}
							onClose={() => {
								handlePreviewDetail(autoDetail)
							}}
							isFileShare={isFileShare}
							onOpenNewPopup={(detail, attachmentTree, attachmentList) => {
								if (isImmersiveFullscreen)
									pubsub.publish(PubSubEvents.Exit_Fullscreen)

								// 打开新弹层用于显示链接文件
								manualFilePopupRef.current?.open(
									detail,
									attachmentTree,
									attachmentList,
								)
							}}
							projectId={projectId}
							allowDownload={allowDownloadProjectFile}
							enableImmersiveShareChrome={enableImmersiveShareChrome}
							isImmersiveFullscreen={isImmersiveFullscreen}
							hideHeader={hidePreviewHeader}
							showFileHeader={showFileHeader}
							forceFullscreenMode={forceFullscreenMode}
							documentFlowFullscreen={documentFlowFullscreen}
							onPreviewFileChange={(fileId) => {
								setPrimaryPreviewFileId(fileId)
								onPreviewFileChange?.(fileId)
							}}
							onPreviewFullscreenChange={onPreviewFullscreenChange}
						/>
						{/* 独立的文件预览 Popup，用于手动选择文件 */}
						{isFileShare && (
							<PreviewDetailPopup
								ref={manualFilePopupRef}
								setUserSelectDetail={(detail) => {
									manualFilePopupRef.current?.open(
										detail,
										attachments.tree,
										attachments.list,
									)
								}}
								onClose={() => {
									onPreviewFileChange?.(primaryPreviewFileId)
									onPreviewFullscreenChange?.(false)
								}}
								isFileShare={false}
								projectId={projectId}
								allowDownload={allowDownloadProjectFile}
								hideHeader={hidePreviewHeader}
								showFileHeader={showFileHeader}
								forceFullscreenMode={forceFullscreenMode}
								documentFlowFullscreen={documentFlowFullscreen}
								onPreviewFileChange={onPreviewFileChange}
								onPreviewFullscreenChange={onPreviewFullscreenChange}
							/>
						)}
					</>
				) : null}

				{hasStarted && (
					<>
						{shouldShowProjectSider ? (
							<>
								<ProjectSider
									width={projectSiderWidth}
									className="m-2 overflow-hidden rounded-lg border bg-background"
									items={[
										{
											key: "topicFiles",
											title: t("topicFiles.title"),
											content: (
												<TopicFilesButton
													showRefresh={false}
													attachments={attachments.tree}
													setUserSelectDetail={(detail: any) => {
														setUserDetail(detail)
													}}
													projectId={projectId}
													shareCode={shareCode}
													sharePassword={sharePassword}
													onCrossProjectOperationSuccess={
														handleCrossProjectOperationSuccess
													}
													className="left-0"
													onFileClick={(fileItem: any) => {
														setUserDetail(null)
														// use setTimeout to ensure the DOM is updated before opening tab
														setTimeout(() => {
															detailRef.current?.openFileTab(fileItem)
														}, 100)
													}}
													activeFileId={activeFileId}
													allowEdit={false}
													allowCopyTo={allowCopySharedFiles}
													filterMenuItems={filterShareMenuItems}
													filterBatchDownloadLayerMenuItems={
														filterBatchDownloadLayerMenuItems
													}
													allowDownload={allowDownloadProjectFile}
												/>
											),
										},
									]}
								/>
								<ResizableDivider
									position="right"
									offsetLeft={projectSiderWidth}
									onResizeStart={handleProjectSiderResizeStart}
									onHoverChange={setIsProjectSiderHovering}
								/>
							</>
						) : null}
						{(isEmpty(autoDetail) &&
							isEmpty(userDetail) &&
							!showAllProjectFiles &&
							!isFileShare) ||
						isMobile ? null : (
							<div
								className={cn(
									documentFlowFullscreen
										? "min-h-dvh w-full flex-1 overflow-visible bg-transparent"
										: shouldRenderFullscreenFileOnly
											? "h-full min-h-0 w-full flex-1 overflow-hidden bg-transparent"
											: "mr-2 flex-1 overflow-y-hidden rounded-lg transition-all duration-300 ease-in-out",
									!isFullscreenMode &&
										!shouldRenderFullscreenFileOnly &&
										"my-2 border border-border bg-card",
									!shouldShowProjectSider && "m-0 border-none bg-transparent",
								)}
							>
								<Detail
									ref={detailRef}
									disPlayDetail={isEmpty(userDetail) ? autoDetail : userDetail}
									attachments={attachments.tree}
									attachmentList={attachments.list}
									userSelectDetail={userDetail}
									setUserSelectDetail={(detail: any) => {
										setUserDetail(detail)
									}}
									topicId={topicId}
									baseShareUrl={baseShareUrl}
									currentTopicStatus={
										isLoadAll ? TaskStatus.FINISHED : TaskStatus.RUNNING
									}
									messages={messageList}
									autoDetail={autoDetail}
									showPlaybackControl={false}
									isFileShare={isFileShare}
									onActiveFileChange={setActiveFileId}
									topicName={resource_name}
									projectId={projectId}
									selectedProject={shareSelectedProject}
									allowDownload={allowDownloadProjectFile}
									hideTabBar={shouldRenderFullscreenFileOnly}
									showFileHeader={
										showFileHeader ??
										(shouldRenderFullscreenFileOnly ? false : undefined)
									}
									forceFullscreenMode={forceFullscreenMode}
									documentFlowFullscreen={documentFlowFullscreen}
								/>
							</div>
						)}
					</>
				)}

				{hasStarted && !isFileShare && !isNewFileShare && (
					<>
						<ResizableDivider
							position="left"
							offsetLeft={messagePanelWidth + 2}
							onResizeStart={handleMessagePanelResizeStart}
							onHoverChange={setIsMessagePanelHovering}
						/>
						<div className={cn("p-2", isMobile ? "w-full" : "")}>
							<div
								className={cn(
									"relative h-full max-w-full overflow-x-hidden overflow-y-hidden rounded-lg border border-border bg-white transition-[width] ease-in-out [transition-duration:800ms] dark:bg-card",
									"max-md:w-full max-md:min-w-0",
									((!showAllProjectFiles &&
										isEmpty(autoDetail) &&
										isEmpty(userDetail)) ||
										!hasStarted) &&
										"w-full min-w-[420px] max-w-[840px] max-md:max-w-none",
									!(
										(!showAllProjectFiles &&
											isEmpty(autoDetail) &&
											isEmpty(userDetail)) ||
										!hasStarted
									) && "w-[420px] min-w-[420px]",
									!hasStarted &&
										"scale-[1.7] [transform:perspective(900px)_rotateX(30deg)_translateY(150px)] max-md:scale-110 max-md:[transform:perspective(550px)_rotateX(20deg)_translateY(-20px)]",
									(isMessagePanelDragging || isMessagePanelHovering) &&
										"select-none !transition-none",
								)}
								style={
									showAllProjectFiles ||
									!isEmpty(autoDetail) ||
									!isEmpty(userDetail)
										? {
												width: messagePanelWidth,
												position: "relative",
											}
										: undefined
								}
							>
								<div className="relative h-full min-h-0 w-full">
									<ScrollArea
										className="h-full min-h-0 w-full [&_[data-slot='scroll-area-viewport']>div]:!block"
										viewportClassName="p-2.5 max-md:pt-[calc(60px+var(--safe-area-inset-top,env(safe-area-inset-top)))]"
										viewportRef={messageContainerRef}
									>
										<MessageList
											allowDownload={allowDownloadProjectFile === true}
											topicId={topicId || data?.project_id || ""}
											messageList={messageList}
											onSelectDetail={(detail) => {
												setUserDetail(detail)
												if (isMobile) {
													handlePreviewDetail(detail)
												}
											}}
											currentTopicStatus={
												isLoadAll ? TaskStatus.FINISHED : TaskStatus.RUNNING
											}
											stickyMessageClassName="[--sticky-message-mask-bg:rgb(255_255_255)] [--sticky-message-mask-fade-from:rgb(255_255_255)]"
											projectFilesStore={projectFilesStore}
											scrollContainerRef={messageContainerRef}
											virtualizerRef={virtualizerRef}
											onVirtualizerChange={handleVirtualizerChange}
										/>
										{!taskIsEnd && messageList?.length > 0 && !hasStarted && (
											<LoadingMessage />
										)}
									</ScrollArea>
									{/* Keep scrolling rows hidden inside the viewport's top padding. */}
									<div
										aria-hidden
										className={cn(
											SHARE_MESSAGE_TOP_MASK_CLASS_NAME,
											"max-md:h-[calc(60px+var(--safe-area-inset-top,env(safe-area-inset-top)))]",
										)}
									/>
									<BackToLatestButton
										visible={showBackToLatest}
										onClick={scrollToBottom}
										className={cn(
											"fixed",
											needAdjustButtonPosition && "!bottom-[58px]",
										)}
									/>
								</div>
							</div>
						</div>
					</>
				)}
			</div>

			{hasStarted && !isFileShare && !isNewFileShare && (
				<div
					className="fixed bottom-0 left-0 right-0 z-[1020] box-border h-[50px] bg-background shadow-[0px_0px_1px_0px_rgba(0,0,0,0.3),0px_0px_30px_0px_rgba(0,0,0,0.06)] max-md:h-[calc(50px+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]"
					data-testid="share-playback-controls"
				>
					<div className="flex flex-col gap-2.5 p-2">
						<div className="flex flex-1 flex-row items-center justify-between max-md:gap-2.5 [&_img]:h-9 [&_img]:w-auto">
							{isMobile && <FooterLogo />}
							{(taskData?.process?.length || 0) > 0 && (
								<div className="mr-[30px] min-w-0 max-w-[400px] shrink overflow-visible max-md:mr-0 max-md:flex-1">
									<TaskList taskData={taskData} />
								</div>
							)}
							{!isMobile && (
								<div className="mr-2.5 flex h-9 w-auto shrink-0 select-none items-center gap-2 p-1 px-2">
									<MagicTooltip title={t("playbackControl.autoPlayback")}>
										<span className="topic-status-shimmer shrink overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal leading-[18px]">
											{isLoadAll
												? t("playbackControl.finished")
												: t("playbackControl.autoPlayback")}
										</span>
									</MagicTooltip>
								</div>
							)}
							<div className="mr-[30px] flex-1 max-md:absolute max-md:-top-[0] max-md:left-0 max-md:right-0 max-md:z-10 max-md:mr-0 max-md:h-[26px]">
								<Slider
									min={0}
									max={messagesWithoutRevoked?.length || 0}
									value={[sliderValue]}
									onValueChange={(values) => handleSliderChange(values[0])}
									onValueCommit={(values) =>
										handleSliderChangeComplete(values[0])
									}
									disabled={!messagesWithoutRevoked?.length}
									className="[&_[data-slot=slider-range]]:bg-foreground [&_[data-slot=slider-thumb]]:hidden [&_[data-slot=slider-track]]:bg-[#d1d1d1]"
									data-testid="share-playback-slider"
								/>
							</div>
							{isBottom ? (
								<Button
									variant="outline"
									className="h-[30px] rounded-full border-border px-5 py-1.5 text-sm font-normal leading-5 text-foreground"
									onClick={replay}
									data-testid="share-playback-replay-button"
								>
									{t("share.replay")}
								</Button>
							) : null}
							{!isBottom ? (
								<Button
									variant="outline"
									className="h-[30px] rounded-full border-border px-5 py-1.5 text-sm font-normal leading-5 text-foreground"
									onClick={handleShowResult}
									data-testid="share-playback-result-button"
								>
									{t("share.viewResult")}
								</Button>
							) : null}
						</div>
					</div>
				</div>
			)}
			{!hasStarted && !isFileShare && (
				<div
					className="fixed bottom-0 left-0 right-0 z-10 flex h-full animate-fadeInUp flex-col items-center justify-center bg-gradient-to-b from-transparent via-[#F9F9F9] to-[#F9F9F9] px-5 pb-0 pt-[60px] transition-all duration-300 ease-in-out dark:via-background dark:to-background"
					data-testid="share-replay-intro"
				>
					<div className="w-[840px] max-md:w-[335px] max-md:max-w-[335px]">
						<div className="mb-5 flex items-center justify-start gap-2.5 rounded-lg">
							<div className="relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-300">
								<div className="absolute -left-[30px] -top-[30px] h-[120px] w-[120px] animate-[spin_3s_linear_infinite] bg-gradient-to-r from-[#FFAFC8] via-[#E08AFF] to-[#9FC3FF] opacity-90"></div>
								<div className="absolute z-10 flex h-[50px] w-[50px] items-center justify-center rounded-full">
									<img
										src={ReplayLogo}
										alt=""
										className="h-[30px] w-[30px] brightness-0 invert"
									/>
								</div>
							</div>
							<div className="flex flex-col items-start">
								<div className="mb-1.5 text-center text-sm font-normal leading-5 text-foreground max-md:text-sm max-md:leading-5">
									{t("share.viewingTask")}
								</div>
								<div className="bg-gradient-to-br from-[#3F8FFF] to-[#EF2FDF] bg-clip-text text-lg font-semibold leading-[1.3333em] text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] max-md:max-h-10 max-md:text-sm max-md:leading-5">
									{resource_name}
								</div>
							</div>
						</div>
						<div className="relative mx-auto flex min-h-[300px] w-full min-w-[200px] flex-col items-center justify-center gap-5 rounded-[20px] bg-white/95 shadow-[0_20px_40px_rgba(0,0,0,0.1)] backdrop-blur-[10px] after:absolute after:bottom-[-1px] after:left-0 after:h-full after:w-full after:rounded-b-lg after:bg-gradient-to-b after:from-transparent after:via-transparent after:to-background dark:bg-white/[0.95] dark:after:to-gray-100">
							<div className="absolute bottom-0 left-0 right-0 top-0 z-10 flex h-full w-full items-center justify-center">
								<div
									className="relative h-20 w-20 cursor-pointer overflow-hidden rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-300 max-md:h-[60px] max-md:w-[60px]"
									onClick={startShowingMessages}
									data-testid="share-replay-play-trigger"
								>
									<div className="absolute -left-[50px] -top-[50px] h-[150px] w-[150px] cursor-pointer bg-black/80 max-md:-left-[30px] max-md:-top-[30px] max-md:h-[120px] max-md:w-[120px]"></div>
									<div className="absolute left-1/2 top-1/2 z-10 flex h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full max-md:h-10 max-md:w-10">
										<IconPlayerPlayFilled
											size={50}
											color="white"
											className="h-[50px] w-[50px] cursor-pointer brightness-0 invert max-md:h-10 max-md:w-10"
										/>
									</div>
								</div>
							</div>
							{/* Static progress bar */}
							<div className="absolute bottom-7 left-6 right-6 z-[1] flex h-6 items-center">
								<div className="absolute bottom-0 left-0 right-0 h-1 w-full overflow-visible rounded-full bg-[#E6E7EA]">
									<div
										className="absolute left-[5px] top-1/2 z-[2] -ml-[5px] h-[13px] w-[13px] -translate-y-1/2 rounded-full border-2 border-white bg-[#315CEC] shadow-[0px_0px_1px_0px_rgba(0,0,0,0.3),0px_4px_14px_0px_rgba(0,0,0,0.1)] transition-[left] duration-300"
										style={{ left: "5px" }}
									/>
								</div>
							</div>
							<div
								className={cn(
									"relative h-full max-h-[500px] overflow-x-hidden overflow-y-hidden rounded-lg bg-background px-[90px] py-7 transition-all ease-in-out [mask-image:linear-gradient(to_bottom,transparent,black_28px,black_calc(100%-28px),transparent)] [transition-duration:800ms] dark:bg-card max-md:max-h-[335px] max-md:min-w-0 max-md:max-w-[calc(100%-40px)] max-md:p-0 max-md:[mask-image:none]",
									((!showAllProjectFiles &&
										isEmpty(autoDetail) &&
										isEmpty(userDetail)) ||
										!hasStarted) &&
										"w-full min-w-[420px] max-w-[840px] max-md:max-w-none",
								)}
							>
								<div
									ref={messageContainerRef}
									className="h-full w-full overflow-y-auto overflow-x-hidden p-2.5"
								>
									<MessageList
										allowDownload={allowDownloadProjectFile === true}
										topicId={topicId || data?.project_id || ""}
										messageList={messageList}
										onSelectDetail={(detail) => {
											setUserDetail(detail)
											if (isMobile) {
												handlePreviewDetail(detail)
											}
										}}
										currentTopicStatus={
											isLoadAll ? TaskStatus.FINISHED : TaskStatus.RUNNING
										}
										stickyMessageClassName="z-1 [--sticky-message-mask-bg:rgb(255_255_255)] [--sticky-message-mask-fade-from:rgb(255_255_255)]"
										projectFilesStore={projectFilesStore}
										scrollContainerRef={messageContainerRef}
										virtualizerRef={virtualizerRef}
										onVirtualizerChange={handleVirtualizerChange}
									/>
									{!taskIsEnd && messageList?.length > 0 && !hasStarted && (
										<LoadingMessage />
									)}
								</div>
							</div>
						</div>
						<div className="flex w-full flex-col items-center gap-3 text-center">
							<div className="my-5 rounded-md backdrop-blur-[5px]">
								<div className="text-xs font-normal leading-4 text-muted-foreground [text-shadow:0_1px_1px_rgba(255,255,255,0.6)] dark:[text-shadow:none] max-md:text-[13px] max-md:leading-[18px]">
									{t("share.replayWillStartIn", { countdown })}
								</div>
							</div>
						</div>
						<div
							className={cn(
								"flex justify-center gap-4",
								isMobile && "flex-col gap-3",
							)}
						>
							<Button
								variant="default"
								size="lg"
								onClick={startShowingMessages}
								className={cn(
									"rounded-lg shadow-md transition-all duration-200 hover:shadow-lg hover:brightness-105 active:scale-[0.98]",
									"dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_4px_12px_rgba(255,255,255,0.06)]",
									isMobile && "w-full",
								)}
								data-testid="share-replay-start-button"
							>
								<IconPlayerPlayFilled
									size={16}
									className="text-primary-foreground"
								/>
								<span>{t("share.viewReplay")}</span>
							</Button>
							<Button
								variant="outline"
								size="lg"
								onClick={handleShowResult}
								className={cn(
									"rounded-lg font-medium transition-all duration-200 hover:bg-accent/50 active:scale-[0.98]",
									"dark:hover:ring-1 dark:hover:ring-white/10",
									isMobile && "w-full",
								)}
								data-testid="share-replay-result-button"
							>
								{t("share.viewResult")}
							</Button>
						</div>
					</div>
				</div>
			)}
			<Popup
				bodyStyle={{
					width: "80%",
					backgroundColor: "#fff",
					padding: "20px",
					borderRadius: "12px 0px 0px 12px",
				}}
				position="right"
				style={{
					zIndex: 1021,
				}}
			>
				<SafeArea position="top" />
				<div className="mt-2.5 border-b border-border">
					<div className="mb-2.5 text-xs font-normal text-muted-foreground">
						{t("share.navigation")}
					</div>
					{!isLogined ? (
						<div
							className="flex h-10 cursor-pointer items-center gap-1 rounded-lg p-2.5 text-sm text-foreground"
							onClick={() =>
								authEventBus.emit(AuthEventName.RequestLogin, {
									reason: "manual",
									source: "share",
									returnTo: window.location.href,
									preserveQuery: true,
								})
							}
							data-testid="share-navigation-login-item"
						>
							<IconLogin className="size-5" />
							{t("share.login")}
						</div>
					) : (
						<div
							className="flex h-10 cursor-pointer items-center gap-1 rounded-lg p-2.5 text-sm text-foreground"
							onClick={() => history.push({ name: RouteName.Super })}
							data-testid="share-navigation-workspace-item"
						>
							<IconLayoutGrid className="size-5" />
							{t("share.enterWorkspace")}
						</div>
					)}
				</div>
				<div className="mt-2.5 border-b border-border">
					<div className="mb-2.5 text-xs font-normal text-muted-foreground">
						{t("share.topic")}
					</div>
					<div
						className="flex h-10 cursor-pointer items-center gap-1 rounded-lg p-2.5 text-sm text-foreground"
						onClick={() => setAttachmentVisible(true)}
						data-testid="share-navigation-files-item"
					>
						<IconFolder className="size-5" /> <span>{t("share.viewProjectFiles")}</span>
					</div>
				</div>
				<SafeArea position="bottom" />
			</Popup>
			<CommonPopup
				popupProps={{
					onMaskClick: () => {
						setAttachmentVisible(false)
						// 重置TopicFilesCore所有状态
						setTimeout(() => {
							topicFilesCoreRef.current?.resetAllStates()
						}, 0)
					},
					onClose: () => {
						setAttachmentVisible(false)
						// 重置TopicFilesCore所有状态
						setTimeout(() => {
							topicFilesCoreRef.current?.resetAllStates()
						}, 0)
					},
					visible: attachmentVisible,
					bodyStyle: {
						backgroundColor: "#fff",
						display: "flex",
						flexDirection: "column",
					},
				}}
				title={t("share.projectFiles")}
			>
				<div
					className="flex flex-1 flex-col gap-2.5 overflow-hidden p-0"
					data-testid="share-project-files-popup"
				>
					<TopicFilesCore
						ref={topicFilesCoreRef}
						attachments={attachments.tree}
						setUserSelectDetail={(detail: any) => {
							setUserDetail(detail)
							if (isMobile && isFileShare) {
								// 文件分享场景：使用独立的 Popup 打开手动选择的文件
								manualFilePopupRef.current?.open(
									detail,
									attachments.tree,
									attachments.list,
								)
							} else if (isMobile) {
								// 非文件分享场景：使用原有逻辑
								handlePreviewDetail(detail)
							}
						}}
						projectId={projectId}
						shareCode={shareCode}
						sharePassword={sharePassword}
						onCrossProjectOperationSuccess={handleCrossProjectOperationSuccess}
						handleDownloadAll={handleDownloadAll}
						allLoading={allLoading}
						activeFileId={activeFileId}
						allowEdit={false}
						allowCopyTo={allowCopySharedFiles}
						filterMenuItems={filterShareMenuItems}
						filterBatchDownloadLayerMenuItems={filterBatchDownloadLayerMenuItems}
						allowDownload={allowDownloadProjectFile}
						allowReadonlySelection
					/>
				</div>
			</CommonPopup>
		</>
	)
}

export default observer(Topic)
